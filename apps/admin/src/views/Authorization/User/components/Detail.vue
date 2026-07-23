<script setup lang="tsx">
import type { UserItem } from '@/api/user/types'
import { Descriptions, DescriptionsSchema } from '@/components/Descriptions'
import { useI18n } from '@/hooks/web/useI18n'
import { ElTag } from 'element-plus'
import { computed, PropType } from 'vue'

const { t } = useI18n()

const props = defineProps({
  currentRow: {
    type: Object as PropType<UserItem | undefined>,
    default: () => undefined
  },
  roleMap: {
    type: Object as PropType<Record<string, string>>,
    default: () => ({})
  }
})

const detailSchema = computed<DescriptionsSchema[]>(() => [
  { field: 'username', label: t('userDemo.username') },
  { field: 'phone', label: t('login.phone') },
  { field: 'email', label: t('userDemo.email') },
  {
    field: 'department.name',
    label: t('userDemo.department')
  },
  {
    field: 'roles',
    label: t('userDemo.role'),
    slots: {
      default: () => {
        const roles = props.currentRow?.roles || []
        if (!roles.length) return null
        return (
          <>
            {roles.map((roleId) => (
              <ElTag key={roleId} class="mr-4px">
                {props.roleMap[roleId] || roleId}
              </ElTag>
            ))}
          </>
        )
      }
    }
  },
  {
    field: 'enabled',
    label: t('menu.status'),
    slots: {
      default: () => (
        <ElTag type={props.currentRow?.enabled ? 'success' : 'danger'}>
          {props.currentRow?.enabled ? t('userDemo.enable') : t('userDemo.disable')}
        </ElTag>
      )
    }
  },
  { field: 'createdAt', label: t('tableDemo.displayTime') }
])
</script>

<template>
  <Descriptions :schema="detailSchema" :data="currentRow || {}" />
</template>
