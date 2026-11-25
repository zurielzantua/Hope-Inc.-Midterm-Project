import { handleCreateDepartmentRequest } from '@/lib/department-mutations';
import { departmentMutationDependencies } from '@/lib/department-mutations-server';
import { handleDepartmentListRequest } from '@/lib/department-list';
import { departmentListDependencies } from '@/lib/department-list-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDepartmentListRequest(request, departmentListDependencies());
}

export async function POST(request: Request) {
  return handleCreateDepartmentRequest(request, departmentMutationDependencies());
}
