import { handleUpdateCustomerRequest } from '@/lib/customer-mutations';
import { customerMutationDependencies } from '@/lib/customer-mutations-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ custNo: string }> }) {
  const { custNo } = await params;
  return handleUpdateCustomerRequest(request, custNo, customerMutationDependencies());
}
