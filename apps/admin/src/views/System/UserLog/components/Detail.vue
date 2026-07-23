<script setup lang="tsx">
import type { LogItem } from '@/api/log/type'
import { Descriptions, DescriptionsSchema } from '@/components/Descriptions'
import { JsonEditor } from '@/components/JsonEditor'
import { ElTag } from 'element-plus'
import { computed, PropType, reactive } from 'vue'

const props = defineProps({
  currentRow: {
    type: Object as PropType<Nullable<LogItem>>,
    default: () => null
  }
})

const detailInfo = computed(() => props.currentRow?.detailInfo || {})

const detailSchema = reactive<DescriptionsSchema[]>([
  {
    field: 'user.username',
    label: '操作人',
    slots: {
      default: () => <div>{props.currentRow?.user?.username || '-'}</div>
    }
  },
  {
    field: 'user.phone',
    label: '手机号',
    slots: {
      default: () => <div>{props.currentRow?.user?.phone || '-'}</div>
    }
  },
  {
    field: 'isSuccess',
    label: '响应状态',
    slots: {
      default: () => {
        const isSuccess = props.currentRow?.isSuccess
        return <ElTag type={isSuccess ? 'success' : 'danger'}>{isSuccess ? '成功' : '失败'}</ElTag>
      }
    }
  },
  {
    field: 'responseMsg',
    label: '响应信息',
    slots: {
      default: () => <div>{props.currentRow?.responseMsg || '-'}</div>
    }
  },
  {
    field: 'duration',
    label: '响应时长',
    slots: {
      default: () => <div>{props.currentRow?.duration != null ? `${props.currentRow.duration}ms` : '-'}</div>
    }
  },

  {
    field: 'method',
    label: '方法'
  },

  {
    field: 'requestUrl',
    label: '路径'
  },
  {
    field: 'ip',
    label: 'IP地址'
  },
  {
    field: 'userAgent',
    label: 'User-Agent'
  },
  {
    field: 'createdAt',
    label: '操作时间'
  }
])
</script>

<template>
  <Descriptions :schema="detailSchema" :data="currentRow || {}" />

  <div v-if="Object.keys(detailInfo).length" class="mt-16px">
    <div class="mb-8px text-14px text-[var(--el-text-color-regular)]">详细信息</div>
    <JsonEditor :model-value="detailInfo" :editable="false" :height="240" />
  </div>
</template>
