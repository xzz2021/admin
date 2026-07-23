<script setup lang="ts">
import { getDepartmentListApi } from '@/api/department'
import { getRoleListApi } from '@/api/role'
import type { CreateUserPayload, UpdateUserPayload, UserItem } from '@/api/user/types'
import { Form, FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { PropType, reactive, watch } from 'vue'

const { t } = useI18n()
const { required } = useValidator()

const props = defineProps({
  currentRow: {
    type: Object as PropType<UserItem | undefined>,
    default: () => undefined
  },
  defaultDepartmentId: {
    type: String,
    default: ''
  }
})

const formSchema = reactive<FormSchema[]>([
  {
    field: 'username',
    label: t('userDemo.username'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'phone',
    label: t('login.phone'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'password',
    label: t('userDemo.password'),
    component: 'InputPassword',
    colProps: { span: 24 },
    hidden: !!props.currentRow
  },
  {
    field: 'department',
    label: t('userDemo.department'),
    component: 'TreeSelect',
    colProps: { span: 24 },
    componentProps: {
      nodeKey: 'id',
      props: {
        label: 'name',
        value: 'id',
        children: 'children'
      },
      highlightCurrent: true,
      expandOnClickNode: false,
      checkStrictly: true,
      checkOnClickNode: true
    },
    optionApi: async () => {
      const res = await getDepartmentListApi()
      return res.data.list || []
    }
  },
  {
    field: 'roles',
    label: t('userDemo.role'),
    component: 'Select',
    value: [],
    colProps: { span: 24 },
    componentProps: {
      multiple: true,
      collapseTags: true,
      maxCollapseTags: 2
    },
    optionApi: async () => {
      const res = await getRoleListApi()
      return (res.data?.list || []).map((role) => ({
        label: role.name,
        value: role.id
      }))
    }
  },
  {
    field: 'email',
    label: t('userDemo.email'),
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'enabled',
    label: t('menu.status'),
    component: 'Switch',
    value: true,
    colProps: { span: 24 },
    componentProps: {
      inlinePrompt: true,
      activeText: t('userDemo.enable'),
      inactiveText: t('userDemo.disable')
    }
  }
])

const rules = reactive<Record<string, ReturnType<typeof required>[]>>({
  username: [required()],
  phone: [required()],
  department: [required()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

export type UserFormData = CreateUserPayload | UpdateUserPayload

const submit = async (): Promise<UserFormData | undefined> => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch(() => false)
  if (!valid) return

  const formData = await getFormData(false)
  const payload = {
    username: formData.username,
    phone: formData.phone,
    department: formData.department,
    roles: formData.roles || [],
    email: formData.email || undefined,
    enabled: formData.enabled ?? true
  }

  if (formData.id) {
    return { ...payload, id: formData.id }
  }

  return { ...payload, password: formData.password }
}

watch(
  () => [props.currentRow, props.defaultDepartmentId] as const,
  ([currentRow, defaultDepartmentId]) => {
    const passwordField = formSchema.find((item) => item.field === 'password')
    if (passwordField) {
      passwordField.hidden = !!currentRow
    }

    if (!currentRow) {
      rules.password = [required()]
      setValues({
        username: '',
        phone: '',
        password: '',
        department: defaultDepartmentId || '',
        roles: [],
        email: '',
        enabled: true
      })
      return
    }

    delete rules.password
    setValues({
      id: currentRow.id,
      username: currentRow.username,
      phone: currentRow.phone,
      department: currentRow.department?.id || '',
      roles: currentRow.roles || [],
      email: currentRow.email || '',
      enabled: currentRow.enabled ?? true
    })
  },
  { immediate: true }
)

defineExpose({ submit })
</script>

<template>
  <Form :rules="rules" label-width="96px" @register="formRegister" :schema="formSchema" />
</template>
