import { handleCreateCustomerRequest } from '@/lib/customer-mutations';
import { customerMutationDependencies } from '@/lib/customer-mutations-server';
import { handleCustomerListRequest } from '@/lib/customer-list';
import { customerListDependencies } from '@/lib/customer-list-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleCustomerListRequest(request, customerListDependencies());
}

export async function POST(request: Request) {
  return handleCreateCustomerRequest(request, customerMutationDependencies());
}
