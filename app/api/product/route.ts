import { handleProductListRequest } from '@/lib/product-list';
import { productListDependencies } from '@/lib/product-list-server';
import { handleCreateProductRequest } from '@/lib/product-mutations';
import { productMutationDependencies } from '@/lib/product-mutations-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleProductListRequest(request, productListDependencies());
}

export async function POST(request: Request) {
  return handleCreateProductRequest(request, productMutationDependencies());
}
