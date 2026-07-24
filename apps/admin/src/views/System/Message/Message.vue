<script setup lang="tsx">
import {
  deleteMessageApi,
  getMessageListApi,
  markAllMessageReadApi,
  markMessageReadApi,
  searchMessageReceiversApi,
  sendAlertApi,
  sendMailApi,
  sendSystemApi
} from '@/api/message'
import type { MessageItem, MessageType } from '@/api/message/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { Table, TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useMessageStore } from '@/store/modules/message'
import dayjs from 'dayjs'
import { ElInput, ElMessage, ElMessageBox, ElOption, ElSelect, ElTag } from 'element-plus'
import { onMounted, reactive, ref, unref } from 'vue'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const list = ref<MessageItem[]>([])
const total = ref(0)
const pageIndex = ref(1)
const pageSize = ref(20)
const typeFilter = ref<MessageType | ''>('')
const unreadOnly = ref(false)
const selectedIds = ref<string[]>([])

type ReceiverOption = { id: string; username: string; nickname?: string | null; phone: string }

const sendVisible = ref(false)
const sendForm = reactive({
  kind: 'system' as 'mail' | 'system' | 'alert',
  receiverId: '',
  title: '',
  content: ''
})
const receiverOptions = ref<ReceiverOption[]>([])
const receiverLoading = ref(false)

const typeLabel = (type: MessageType) => {
  if (type === 'MAIL') return t('message.typeMail')
  if (type === 'SYSTEM') return t('message.typeSystem')
  return t('message.typeAlert')
}

const typeTag = (type: MessageType) => {
  if (type === 'ALERT') return 'danger'
  if (type === 'SYSTEM') return 'warning'
  return 'info'
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getMessageListApi({
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
      type: typeFilter.value || undefined,
      unreadOnly: unreadOnly.value || undefined
    })
    list.value = res.data?.list ?? []
    total.value = res.data?.total ?? 0
    if (typeof res.data?.unread === 'number') {
      messageStore.setUnread(res.data.unread)
    }
  } finally {
    loading.value = false
  }
}

const onSelectionChange = (rows: MessageItem[]) => {
  selectedIds.value = rows.map((r) => r.id)
}

const markRead = async (ids: string[]) => {
  if (!ids.length) {
    ElMessage.warning(t('message.selectFirst'))
    return
  }
  const res = await markMessageReadApi(ids).catch(() => null)
  if (res) {
    ElMessage.success(res.message || t('message.markReadSuccess'))
    messageStore.setUnread(res.data?.unread ?? messageStore.unread)
    fetchList()
  }
}

const markAll = async () => {
  const res = await markAllMessageReadApi().catch(() => null)
  if (res) {
    ElMessage.success(res.message || t('message.markAllSuccess'))
    messageStore.setUnread(0)
    fetchList()
  }
}

const removeSelected = async () => {
  if (!selectedIds.value.length) {
    ElMessage.warning(t('message.selectFirst'))
    return
  }
  try {
    await ElMessageBox.confirm(t('message.deleteConfirm'), t('common.reminder'), { type: 'warning' })
  } catch {
    return
  }
  const res = await deleteMessageApi(unref(selectedIds)).catch(() => null)
  if (res) {
    ElMessage.success(res.message || t('message.deleteSuccess'))
    messageStore.setUnread(res.data?.unread ?? messageStore.unread)
    fetchList()
  }
}

const openSend = () => {
  sendForm.kind = 'system'
  sendForm.receiverId = ''
  sendForm.title = ''
  sendForm.content = ''
  receiverOptions.value = []
  sendVisible.value = true
}

const searchReceivers = async (keyword: string) => {
  receiverLoading.value = true
  try {
    const res = await searchMessageReceiversApi(keyword || undefined).catch(() => null)
    receiverOptions.value = res?.data?.list ?? []
  } finally {
    receiverLoading.value = false
  }
}

const submitSend = async () => {
  if (!sendForm.title.trim() || !sendForm.content.trim()) {
    ElMessage.warning(t('message.fillRequired'))
    return
  }
  if (sendForm.kind === 'mail' && !sendForm.receiverId) {
    ElMessage.warning(t('message.selectReceiver'))
    return
  }

  const title = sendForm.title.trim()
  const content = sendForm.content.trim()
  let res = null as Awaited<ReturnType<typeof sendSystemApi>> | null
  if (sendForm.kind === 'mail') {
    res = await sendMailApi({ receiverId: sendForm.receiverId, title, content }).catch(() => null)
  } else if (sendForm.kind === 'alert') {
    res = await sendAlertApi({ title, content }).catch(() => null)
  } else {
    res = await sendSystemApi({ title, content }).catch(() => null)
  }
  if (res) {
    ElMessage.success(res.message || t('message.sendQueued'))
    sendVisible.value = false
  }
}

const tableColumns = reactive<TableColumn[]>([
  { field: 'selection', type: 'selection', width: 48 },
  { field: 'index', label: t('tableDemo.index'), type: 'index', width: 60 },
  {
    field: 'type',
    label: t('message.type'),
    width: 100,
    slots: {
      default: (data: { row: MessageItem }) => (
        <ElTag size="small" type={typeTag(data.row.type)}>
          {typeLabel(data.row.type)}
        </ElTag>
      )
    }
  },
  {
    field: 'title',
    label: t('message.title'),
    minWidth: 160,
    slots: {
      default: (data: { row: MessageItem }) => <span class={!data.row.readAt ? 'font-600' : ''}>{data.row.title}</span>
    }
  },
  {
    field: 'content',
    label: t('message.content'),
    minWidth: 220,
    formatter: (row: MessageItem) => row.content
  },
  {
    field: 'sender',
    label: t('message.sender'),
    width: 110,
    formatter: (row: MessageItem) => row.sender?.username || '-'
  },
  {
    field: 'createdAt',
    label: t('message.time'),
    width: 170,
    formatter: (row: MessageItem) => dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss')
  },
  {
    field: 'readAt',
    label: t('message.status'),
    width: 90,
    slots: {
      default: (data: { row: MessageItem }) =>
        data.row.readAt ? (
          <ElTag size="small" type="info">
            {t('message.read')}
          </ElTag>
        ) : (
          <ElTag size="small" type="danger">
            {t('message.unread')}
          </ElTag>
        )
    }
  },
  {
    field: 'action',
    label: t('message.action'),
    width: 100,
    fixed: 'right',
    slots: {
      default: (data: { row: MessageItem }) =>
        !data.row.readAt ? (
          <BaseButton type="primary" link onClick={() => markRead([data.row.id])}>
            {t('message.markRead')}
          </BaseButton>
        ) : (
          <span class="text-12px text-[var(--el-text-color-secondary)]">-</span>
        )
    }
  }
])

onMounted(fetchList)
</script>

<template>
  <ContentWrap :title="t('router.message')">
    <div class="mb-12px flex flex-wrap items-center justify-between gap-8px">
      <div class="flex items-center gap-8px flex-wrap">
        <ElSelect v-model="typeFilter" clearable class="w-140px" :placeholder="t('message.type')" @change="fetchList">
          <ElOption :label="t('message.typeMail')" value="MAIL" />
          <ElOption :label="t('message.typeSystem')" value="SYSTEM" />
          <ElOption :label="t('message.typeAlert')" value="ALERT" />
        </ElSelect>
        <BaseButton
          :type="unreadOnly ? 'primary' : 'default'"
          @click="
            unreadOnly = !unreadOnly
            fetchList()
          "
        >
          {{ t('message.unreadOnly') }}
        </BaseButton>
        <ElTag type="danger" effect="plain">{{ t('message.unread') }} {{ messageStore.unread }}</ElTag>
      </div>
      <div class="flex items-center gap-8px flex-wrap">
        <BaseButton @click="markRead(selectedIds)">{{ t('message.markRead') }}</BaseButton>
        <BaseButton @click="markAll">{{ t('message.markAll') }}</BaseButton>
        <BaseButton type="danger" @click="removeSelected">{{ t('common.delete') }}</BaseButton>
        <BaseButton type="primary" v-hasPermi="'message:send'" @click="openSend">{{ t('message.send') }}</BaseButton>
        <BaseButton @click="fetchList">{{ t('common.refresh') }}</BaseButton>
      </div>
    </div>

    <Table
      :columns="tableColumns"
      :data="list"
      :loading="loading"
      :pagination="{ total }"
      v-model:currentPage="pageIndex"
      v-model:pageSize="pageSize"
      row-key="id"
      @selection-change="onSelectionChange"
      @update:current-page="fetchList"
      @update:page-size="fetchList"
    />

    <Dialog v-model="sendVisible" :title="t('message.send')" width="520px">
      <div class="flex flex-col gap-12px">
        <ElSelect v-model="sendForm.kind" class="w-full">
          <ElOption :label="t('message.typeMail')" value="mail" />
          <ElOption :label="t('message.typeSystem')" value="system" />
          <ElOption :label="t('message.typeAlert')" value="alert" />
        </ElSelect>
        <ElSelect
          v-if="sendForm.kind === 'mail'"
          v-model="sendForm.receiverId"
          filterable
          remote
          clearable
          class="w-full"
          :placeholder="t('message.receiver')"
          :remote-method="searchReceivers"
          :loading="receiverLoading"
          @focus="searchReceivers('')"
        >
          <ElOption
            v-for="item in receiverOptions"
            :key="item.id"
            :label="`${item.username}${item.nickname ? ` (${item.nickname})` : ''}`"
            :value="item.id"
          />
        </ElSelect>
        <ElInput v-model="sendForm.title" :placeholder="t('message.title')" maxlength="200" />
        <ElInput
          v-model="sendForm.content"
          type="textarea"
          :rows="5"
          :placeholder="t('message.content')"
          maxlength="5000"
        />
      </div>
      <template #footer>
        <BaseButton @click="sendVisible = false">{{ t('common.cancel') }}</BaseButton>
        <BaseButton type="primary" @click="submitSend">{{ t('common.ok') }}</BaseButton>
      </template>
    </Dialog>
  </ContentWrap>
</template>
