import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../lib/auth/core.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {accountDecision,handleLoginRequest,authorizeSession,handleLogoutRequest,persistAuthorizedSession,readSetupCompletion,readSetupJwtIdentity,readVerifiedSetupSession}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const good={account_state:'approved',is_blocked:false,is_deleted:false,role_code:'user',role_is_deleted:false,setup_complete:true};
function request(body){return new Request('http://localhost/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})}
function dependencies(options={}){const calls=[];return {calls,signIn:async()=>options.signIn===undefined?{userId:'u1',accessToken:'access',refreshToken:'refresh'}:options.signIn,verifyIdentity:async()=>options.verifiedId??'u1',lookupAccount:async()=>{if(options.lookupError)throw Error('private database details');return options.account===undefined?good:options.account},persistSession:async()=>{calls.push('persist');if(options.persistError)throw Error('private cookie details')},revokeSession:async()=>{calls.push('revoke')}}}
for(const [name,profile,want] of [['approved',good,'allowed'],['pending',{...good,account_state:'pending'},'pending'],['blocked',{...good,is_blocked:true},'blocked'],['deleted',{...good,is_deleted:true},'denied'],['missing',null,'denied'],['inactive role',{...good,role_is_deleted:true},'denied'],['unknown role',{...good,role_code:'unknown'},'denied']]) test(`account decision: ${name}`,()=>assert.equal(accountDecision(profile),want));
test('approved credentials persist a session without exposing tokens',async()=>{const d=dependencies();const r=await handleLoginRequest(request({email:'user@example.test',password:'secret'}),d);assert.equal(r.status,200);assert.deepEqual(d.calls,['persist']);assert.doesNotMatch(await r.text(),/access|refresh|secret/)});
test('invalid credentials do not persist a session',async()=>{const d=dependencies({signIn:null});const r=await handleLoginRequest(request({email:'user@example.test',password:'wrong'}),d);assert.equal(r.status,401);assert.deepEqual(d.calls,[])});
for(const [name,account] of [['pending',{...good,account_state:'pending'}],['blocked',{...good,is_blocked:true}],['deleted',{...good,is_deleted:true}],['missing',null]])test(`${name} account is denied and session revoked`,async()=>{const d=dependencies({account});const r=await handleLoginRequest(request({email:'user@example.test',password:'secret'}),d);assert.equal(r.status,403);assert.deepEqual(d.calls,['revoke'])});
test('identity mismatch fails closed and revokes the temporary session',async()=>{const d=dependencies({verifiedId:'u2'});const r=await handleLoginRequest(request({email:'user@example.test',password:'secret'}),d);assert.equal(r.status,401);assert.deepEqual(d.calls,['revoke'])});
test('database failure fails closed without leaking details',async()=>{const d=dependencies({lookupError:true});const r=await handleLoginRequest(request({email:'user@example.test',password:'secret'}),d);assert.equal(r.status,503);assert.deepEqual(d.calls,['revoke']);assert.doesNotMatch(await r.text(),/private database/) });
test('invalid input and extra fields are rejected before authentication',async()=>{const d=dependencies();const r=await handleLoginRequest(request({email:'x',password:'secret',role:'superadmin'}),d);assert.equal(r.status,400);assert.deepEqual(d.calls,[])});
test('session persistence failure revokes the temporary session',async()=>{const d=dependencies({persistError:true});const r=await handleLoginRequest(request({email:'user@example.test',password:'secret'}),d);assert.equal(r.status,503);assert.deepEqual(d.calls,['persist','revoke'])});
test('an existing session loses access when its account is blocked',async()=>{let profile=good;const verify=async()=>'u1';const lookup=async(id)=>{assert.equal(id,'u1');return profile};assert.equal((await authorizeSession(verify,lookup)).allowed,true);profile={...good,is_blocked:true};assert.equal((await authorizeSession(verify,lookup)).allowed,false)});
test('protected access fails closed for missing identity and database errors',async()=>{assert.equal((await authorizeSession(async()=>null,async()=>good)).allowed,false);assert.equal((await authorizeSession(async()=>'u1',async()=>{throw Error('database unavailable')})).allowed,false)});
test('logout calls the session provider and returns no-store',async()=>{let called=false;const r=await handleLogoutRequest(async()=>{called=true});assert.equal(called,true);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/)});
test('logout provider failure returns a generic error',async()=>{const r=await handleLogoutRequest(async()=>{throw Error('private token')});assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private token/)});
test('partial cookie persistence failure clears the cookie session',async()=>{const calls=[];const client={auth:{setSession:async()=>{throw Error('cookie write failed')},signOut:async(options)=>{calls.push(options)}}};await assert.rejects(()=>persistAuthorizedSession(client,'access','refresh'));assert.deepEqual(calls,[{scope:'local'}])});
test('approved account without a verified first-setup marker cannot receive a session',async()=>{const d=dependencies({account:{...good,setup_complete:null}});const r=await handleLoginRequest(request({email:'user@example.test',password:'secret'}),d);assert.equal(r.status,503);assert.deepEqual(d.calls,['revoke'])});
test('approved account with incomplete first setup is denied',async()=>{const d=dependencies({account:{...good,setup_complete:false}});const r=await handleLoginRequest(request({email:'user@example.test',password:'secret'}),d);assert.equal(r.status,403);assert.deepEqual(d.calls,['revoke'])});
test('existing session without verified setup completion cannot access protected resources',async()=>{const access=await authorizeSession(async()=>'u1',async()=>({...good,setup_complete:null}));assert.equal(access.allowed,false)});
test('first-setup status accepts only the trusted Auth app metadata for the expected identity',()=>{
  const user={id:'u1',app_metadata:{hope_first_password_complete:true},user_metadata:{hope_first_password_complete:false}};
  assert.equal(readSetupCompletion(user,'u1'),true);
  assert.equal(readSetupCompletion({...user,app_metadata:{hope_first_password_complete:false}},'u1'),false);
  assert.equal(readSetupCompletion({...user,app_metadata:{}},'u1'),null);
  assert.equal(readSetupCompletion({...user,app_metadata:{hope_first_password_complete:'true'}},'u1'),null);
  assert.equal(readSetupCompletion({...user,user_metadata:{hope_first_password_complete:true},app_metadata:{}},'u1'),null);
  assert.equal(readSetupCompletion(user,'another-user'),null);
  assert.equal(readSetupCompletion(null,'u1'),null);
});
test('protected requests require the current verified JWT setup marker',()=>{
  assert.equal(readSetupJwtIdentity({sub:'u1',app_metadata:{hope_first_password_complete:true}}),'u1');
  assert.equal(readSetupJwtIdentity({sub:'u1',app_metadata:{hope_first_password_complete:false}}),null);
  assert.equal(readSetupJwtIdentity({sub:'u1',app_metadata:{}}),null);
  assert.equal(readSetupJwtIdentity({sub:'u1',user_metadata:{hope_first_password_complete:true}}),null);
  assert.equal(readSetupJwtIdentity({sub:4,app_metadata:{hope_first_password_complete:true}}),null);
  assert.equal(readSetupJwtIdentity(null),null);
});
test('setup access is bound to the verified invitation session in trusted Auth metadata',()=>{
  const claims={sub:'u1',session_id:'session-1'};
  const user={id:'u1',app_metadata:{hope_first_password_complete:false,hope_first_password_session:'session-1',hope_first_password_session_expires_at:1100}};
  assert.equal(readVerifiedSetupSession(claims,user,'u1',1000),'session-1');
  assert.equal(readVerifiedSetupSession(claims,user,'u1',1100),null);
  assert.equal(readVerifiedSetupSession({...claims,session_id:'other'},user,'u1',1000),null);
  assert.equal(readVerifiedSetupSession(claims,{...user,app_metadata:{hope_first_password_complete:false},user_metadata:{hope_first_password_session:'session-1'}},'u1',1000),null);
  assert.equal(readVerifiedSetupSession(claims,{...user,app_metadata:{...user.app_metadata,hope_first_password_complete:true}},'u1',1000),null);
  assert.equal(readVerifiedSetupSession(claims,user,'other',1000),null);
});
