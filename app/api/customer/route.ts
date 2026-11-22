import { handleCustomerListRequest } from '@/lib/customer-list';
import { customerListDependencies } from '@/lib/customer-list-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleCustomerListRequest(request, customerListDependencies());
}
