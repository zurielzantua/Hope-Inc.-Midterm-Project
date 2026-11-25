import { handleUpdateDepartmentRequest } from '@/lib/department-mutations';
import { departmentMutationDependencies } from '@/lib/department-mutations-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ deptCode: string }> }) {
  const { deptCode } = await params;
  return handleUpdateDepartmentRequest(request, deptCode, departmentMutationDependencies());
}
