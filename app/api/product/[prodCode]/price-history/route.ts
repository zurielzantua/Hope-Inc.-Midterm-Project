import { handleCreatePriceRequest } from '@/lib/price-history';
import { priceHistoryDependencies } from '@/lib/price-history-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ prodCode: string }> }) {
  const { prodCode } = await params;
  return handleCreatePriceRequest(request, prodCode, priceHistoryDependencies());
}
