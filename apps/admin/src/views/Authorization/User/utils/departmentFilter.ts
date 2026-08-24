import type { DepartmentItem } from '@/api/department/types'

/** 虚拟根节点，仅用于前端筛选，不对应真实部门 */
export const ALL_DEPARTMENT_NODE_ID = '__all__'

export const withAllDepartmentNode = (tree: DepartmentItem[], label: string): DepartmentItem[] => [
  { id: ALL_DEPARTMENT_NODE_ID, name: label },
  ...tree,
]

/** 选中「全部」时不传部门 id，由后端返回全量用户 */
export const toUserListDepartmentId = (nodeId: string): string | undefined =>
  !nodeId || nodeId === ALL_DEPARTMENT_NODE_ID ? undefined : nodeId
