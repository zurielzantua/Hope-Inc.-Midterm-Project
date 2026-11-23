import { handleUpdatePriceRequest } from '@/lib/price-history';
import { priceHistoryDependencies } from '@/lib/price-history-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ prodCode: string; effectiveDate: string }> }) {
  const { prodCode, effectiveDate } = await params;
  return handleUpdatePriceRequest(request, prodCode, effectiveDate, priceHistoryDependencies());
}
