import { PgService } from '@/prisma/pg.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import { DictionarySeedArrayDto, UpsertDictionaryDto } from './dto/dictionary.dto'
import { UpsertItemDto } from './dto/entry.dto'

@Injectable()
export class DictionaryService {
  constructor(private readonly pgService: PgService) {}

  async batchRemove(ids: string[]) {
    const res = await this.pgService.dictionaryType.deleteMany({ where: { id: { in: ids } } })
    const count = res?.count || 0
    if (count > 0 && count === ids.length) return { count, message: '删除字典成功' }
    return { count, message: '删除字典部分失败' }
  }

  async upsertDictionary(upsertDictionaryDto: UpsertDictionaryDto) {
    const { id, status, name, code } = upsertDictionaryDto
    const data = {
      name,
      code,
      ...(status !== undefined ? { enabled: status } : {}),
    }

    if (id) {
      const result = await this.pgService.dictionaryType.update({
        where: { id },
        data,
        select: { id: true },
      })
      return { id: result.id, message: '更新字典成功' }
    }

    const result = await this.pgService.dictionaryType.create({
      data,
      select: { id: true },
    })
    return { id: result.id, message: '新增字典成功' }
  }

  async upsertEntry(upsertEntryData: UpsertItemDto) {
    const { id, dictionaryId, name, code, sort, enabled } = upsertEntryData
    if (!dictionaryId) {
      throw new BadRequestException('父级字典不能为空')
    }

    const data = {
      label: name,
      value: code,
      sort: sort ?? 0,
      ...(enabled !== undefined ? { enabled } : {}),
      typeId: dictionaryId,
    }

    if (id) {
      const result = await this.pgService.dictionaryItem.update({
        where: { id },
        data,
        select: { id: true },
      })
      return { id: result.id, message: '更新字典项成功' }
    }

    const result = await this.pgService.dictionaryItem.create({
      data,
      select: { id: true },
    })
    return { id: result.id, message: '新增字典项成功' }
  }

  async batchRemoveEntry(ids: string[]) {
    const res = await this.pgService.dictionaryItem.deleteMany({
      where: { id: { in: ids } },
    })
    const count = res?.count || 0
    if (count > 0 && count === ids.length) return { count, message: '删除字典项成功' }

    throw new BadRequestException('删除字典项部分失败')
  }

  async findAll() {
    const res = await this.pgService.dictionaryType.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        enabled: true,
        createdAt: true,
        items: {
          orderBy: {
            sort: 'asc',
          },
        },
      },
    })
    return { list: res, message: '获取所有字典列表成功' }
  }

  async generateDictionarySeed(data: DictionarySeedArrayDto) {
    await this.pgService.$transaction(async tx => {
      for (const dict of data.data) {
        const { code, entries, status, ...rest } = dict
        const dictionary = await tx.dictionaryType.upsert({
          where: { code: dict.code },
          create: {
            code: dict.code,
            name: rest.name,
            ...(status !== undefined ? { enabled: status } : {}),
          },
          update: {
            name: rest.name,
            ...(status !== undefined ? { enabled: status } : {}),
          },
        })
        for (const e of entries ?? []) {
          await tx.dictionaryItem.upsert({
            where: { typeId_value: { typeId: dictionary.id, value: e.code } },
            create: {
              label: e.name,
              value: e.code,
              sort: e.sort ?? 0,
              ...(e.enabled !== undefined ? { enabled: e.enabled } : {}),
              typeId: dictionary.id,
            },
            update: {
              label: e.name,
              value: e.code,
              sort: e.sort ?? 0,
              ...(e.enabled !== undefined ? { enabled: e.enabled } : {}),
            },
          })
        }
      }
    })

    return { message: '新增字典成功', success: true }
  }
}
