import { handleProductListRequest } from '@/lib/product-list';
import { productListDependencies } from '@/lib/product-list-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleProductListRequest(request, productListDependencies());
}
