<script setup lang="ts">
import { getDepartmentListApi } from '@/api/department'
import type { DepartmentItem } from '@/api/department/types'
import { Form, FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { PropType, reactive, ref, watch } from 'vue'
import { filterDepartmentTreeForParent } from '../utils/departmentTree'

const { t } = useI18n()
const { required } = useValidator()

const props = defineProps({
  currentRow: {
    type: Object as PropType<DepartmentItem | null>,
    default: () => null
  }
})

const editingId = ref<string>()

const formSchema = reactive<FormSchema[]>([
  {
    field: 'parentId',
    label: t('userDemo.superiorDepartment'),
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
      checkOnClickNode: true,
      clearable: true
    },
    optionApi: async () => {
      const res = await getDepartmentListApi()
      return filterDepartmentTreeForParent(res.data.list || [], editingId.value)
    }
  },
  {
    field: 'name',
    label: t('userDemo.departmentName'),
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
  },
  {
    field: 'description',
    label: t('userDemo.remark'),
    component: 'Input',
    colProps: { span: 24 },
    componentProps: {
      type: 'textarea',
      rows: 4,
      maxlength: 200,
      showWordLimit: true
    }
  }
])

const rules = reactive({
  name: [required()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

import type { CreateDepartmentDto } from '@/api/department/types'

export type DepartmentFormData = CreateDepartmentDto & { id?: string }

const submit = async (): Promise<DepartmentFormData | undefined> => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch(() => false)
  if (!valid) return

  const formData = await getFormData(false)
  return {
    id: formData.id,
    parentId: formData.parentId || null,
    name: formData.name,
    enabled: formData.enabled ?? true,
    description: formData.description ?? ''
  }
}

watch(
  () => props.currentRow,
  (currentRow) => {
    editingId.value = currentRow?.id
    if (!currentRow) {
      setValues({
        parentId: null,
        name: '',
        enabled: true,
        description: ''
      })
      return
    }

    setValues({
      id: currentRow.id,
      parentId: currentRow.parentId ?? null,
      name: currentRow.name,
      enabled: currentRow.enabled ?? true,
      description: currentRow.description ?? ''
    })
  },
  { immediate: true }
)

defineExpose({ submit })
</script>

<template>
  <Form :rules="rules" label-width="96px" @register="formRegister" :schema="formSchema" />
</template>
