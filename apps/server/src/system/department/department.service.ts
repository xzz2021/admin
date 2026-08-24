import { AuditAction } from '@/core/logger/audit-action'
import { AuditLogService } from '@/core/logger/audit-log.service'
import { Prisma } from '@/prisma/generated/prisma/client'
import { assertAcyclicParent } from '@/processor/utils/tree-cycle'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DepartmentRepository } from './department.repository'
import { CreateDepartmentDto, DepartmentSeedDto, UpdateDepartmentDto } from './dto/department.dto'

@Injectable()
export class DepartmentService {
  constructor(
    private readonly departments: DepartmentRepository,
    private readonly audit: AuditLogService,
  ) {}

  async add(createDepartmentDto: CreateDepartmentDto, operatorId?: string, ip?: string) {
    try {
      const res = await this.departments.transaction(async tx => {
        const tag = await this.departments.create({ ...createDepartmentDto, path: '' }, tx)
        const path = await this.buildPath(tag.id, createDepartmentDto.parentId ?? null, tx)
        return this.departments.updateById(tag.id, { path }, tx)
      })
      await this.audit.record({
        actorId: operatorId,
        action: AuditAction.DEPARTMENT_CREATE,
        resource: 'Department',
        resourceId: res.id,
        ip,
        metadata: { name: createDepartmentDto.name, parentId: createDepartmentDto.parentId },
      })
      return { id: res.id, message: '添加部门成功' }
    } catch (error) {
      this.rethrowDuplicateName(error)
    }
  }

  async findAll() {
    const [list, total] = await Promise.all([this.departments.findRootTrees(), this.departments.count()])
    return { list, total, message: '获取部门列表成功' }
  }

  async update(updateDepartmentDto: UpdateDepartmentDto, operatorId?: string, ip?: string) {
    const { id, parentId, ...rest } = updateDepartmentDto
    try {
      const res = await this.departments.transaction(async tx => {
        const departments = await this.departments.findTreeLinks(tx)
        const current = departments.find(item => item.id === id)
        if (!current) throw new BadRequestException('部门不存在')

        const nextParentId = parentId === undefined ? current.parentId : parentId
        assertAcyclicParent(departments, id, nextParentId, '部门')

        const parent = nextParentId ? departments.find(item => item.id === nextParentId) : null
        const nextPath = parent ? `${parent.path}/${id}` : `/${id}`

        const updated = await this.departments.updateById(
          id,
          {
            ...rest,
            ...(parentId === undefined ? {} : { parentId }),
            path: nextPath,
          },
          tx,
        )

        if (nextPath !== current.path) {
          await this.departments.replaceDescendantPaths(current.path, nextPath, tx)
        }

        return updated
      })
      await this.audit.record({
        actorId: operatorId,
        action: AuditAction.DEPARTMENT_UPDATE,
        resource: 'Department',
        resourceId: res.id,
        ip,
        metadata: { name: rest.name, parentId },
      })
      return { id: res.id, message: '更新部门成功' }
    } catch (error) {
      this.rethrowDuplicateName(error)
    }
  }

  async delete(id: string, operatorId?: string, ip?: string) {
    const me = await this.departments.findPathById(id)
    if (!me) return
    const child = await this.departments.findFirstChildId(id)
    if (child) throw new BadRequestException('当前项有子部门无法删除')
    await this.departments.deleteById(id)
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.DEPARTMENT_DELETE,
      resource: 'Department',
      resourceId: id,
      ip,
    })
    return { message: '删除部门成功' }
  }

  async generateDepartmentSeed(data: DepartmentSeedDto[]) {
    try {
      await this.departments.transaction(async tx => {
        for (const dept of data) {
          await this.upsertNode(tx, dept, null)
        }
      })
      return { message: '批量插入部门成功' }
    } catch (error) {
      this.rethrowDuplicateName(error)
    }
  }

  private async upsertNode(tx: Prisma.TransactionClient, node: DepartmentSeedDto, parentId: string | null) {
    const { name, enabled, description, children } = node
    const tag = await this.departments.create({ name, enabled, description, path: '' }, tx)
    const path = await this.buildPath(tag.id, parentId, tx)
    await this.departments.updateById(tag.id, { path, parentId }, tx)

    if (children && children.length > 0) {
      for (const child of children) {
        await this.upsertNode(tx, child, tag.id)
      }
    }
  }

  private async buildPath(id: string, parentId: string | null, tx: Prisma.TransactionClient) {
    if (!parentId) return `/${id}`
    const parent = await this.departments.findPathById(parentId, tx)
    if (!parent) throw new BadRequestException('父级不存在')
    return `${parent.path}/${id}`
  }

  private rethrowDuplicateName(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('同级已存在同名部门')
    }
    throw error
  }
}
