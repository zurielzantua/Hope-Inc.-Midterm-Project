import { handleProductStatusRequest } from '@/lib/product-mutations';
import { productMutationDependencies } from '@/lib/product-mutations-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ prodCode: string }> }) {
  const { prodCode } = await params;
  return handleProductStatusRequest(request, prodCode, productMutationDependencies());
}
