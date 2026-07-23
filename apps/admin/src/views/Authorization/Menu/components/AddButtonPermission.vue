<script setup lang="ts">
import type { MenuPermission, PermissionType } from '@/api/menu/types'
import { BaseButton } from '@/components/Button'
import { Form, FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useValidator } from '@/hooks/web/useValidator'
import { ElDrawer, ElInput, ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  buildPermissionCode,
  getPermissionCodePrefix,
  getPermissionCodeSuffix,
  PERMISSION_CODE_SUFFIX_PATTERN
} from '../utils/permissionCode'

const modelValue = defineModel<boolean>({ default: false })

const props = defineProps<{
  menuPath?: string
  editData?: MenuPermission | null
  confirmLoading?: boolean
}>()

const { required } = useValidator()

const PERMISSION_TYPE_OPTIONS = [
  { label: '按钮权限', value: 'BUTTON' },
  { label: '数据权限', value: 'DATA' },
  { label: '接口权限', value: 'API' },
  { label: '其他', value: 'OTHER' }
]

const codeSuffix = ref('')
const codePrefix = computed(() => getPermissionCodePrefix(props.menuPath))
const isEdit = computed(() => !!props.editData?.id)
const drawerTitle = computed(() => (isEdit.value ? '编辑权限' : '新增权限'))

const { t } = useI18n()

const formSchema = reactive<FormSchema[]>([
  {
    field: 'name',
    label: '权限名称',
    component: 'Input',
    colProps: { span: 24 }
  },
  {
    field: 'type',
    label: '权限类型',
    component: 'Select',
    value: 'BUTTON',
    colProps: { span: 24 },
    componentProps: {
      options: PERMISSION_TYPE_OPTIONS
    }
  },
  {
    field: 'sort',
    label: '排序',
    component: 'InputNumber',
    value: 0,
    colProps: { span: 24 },
    componentProps: { min: 0 }
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

const { formRegister, formMethods } = useForm()
const { getFormData, getElFormExpose, setValues } = formMethods

const emit = defineEmits<{
  confirm: [data: MenuPermission]
}>()

const rules = reactive({
  name: [required()],
  type: [required()]
})

const resetForm = () => {
  codeSuffix.value = ''
  setValues({
    name: '',
    type: 'BUTTON' as PermissionType,
    sort: 0,
    enabled: true
  })
}

const fillForm = (data: MenuPermission) => {
  codeSuffix.value = getPermissionCodeSuffix(data.code, props.menuPath)
  setValues({
    name: data.name,
    type: data.type,
    sort: data.sort ?? 0,
    enabled: data.enabled ?? true
  })
}

watch(
  () => [modelValue.value, props.editData] as const,
  ([visible, editData]) => {
    if (!visible) return
    if (editData) {
      fillForm(editData)
    } else {
      resetForm()
    }
  }
)

const confirm = async () => {
  if (!props.menuPath?.trim()) {
    ElMessage.warning('请先填写菜单路径')
    return
  }
  if (!codeSuffix.value.trim()) {
    ElMessage.warning('请填写权限编码后缀')
    return
  }
  if (!PERMISSION_CODE_SUFFIX_PATTERN.test(codeSuffix.value.trim())) {
    ElMessage.warning('编码后缀只能包含字母、数字、下划线，且必须以字母开头')
    return
  }

  const elFormExpose = await getElFormExpose()
  if (!elFormExpose) return
  const valid = await elFormExpose?.validate().catch((err) => {
    console.log(err)
  })
  if (!valid) return

  try {
    const formData = await getFormData()
    const code = buildPermissionCode(props.menuPath, codeSuffix.value)
    emit('confirm', {
      ...(props.editData ?? {}),
      name: formData.name,
      code,
      type: formData.type,
      sort: formData.sort ?? 0,
      enabled: formData.enabled ?? true
    })
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '编码格式不正确')
  }
}
</script>

<template>
  <ElDrawer v-model="modelValue" :title="drawerTitle" size="420px" destroy-on-close>
    <template #default>
      <Form :rules="rules" @register="formRegister" :schema="formSchema" />
      <div class="permission-code-field">
        <div class="permission-code-field__label">权限编码</div>
        <ElInput v-model="codeSuffix" placeholder="如 update、delete、view">
          <template v-if="codePrefix" #prepend>{{ codePrefix }}:</template>
        </ElInput>
        <div class="permission-code-field__tip">只需输入动作后缀，提交时自动拼接菜单 path</div>
      </div>
    </template>
    <template #footer>
      <BaseButton @click="modelValue = false">取消</BaseButton>
      <BaseButton type="primary" :loading="confirmLoading" @click="confirm">确认</BaseButton>
    </template>
  </ElDrawer>
</template>

<style scoped>
.permission-code-field {
  padding: 0 12px;
}

.permission-code-field__label {
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.permission-code-field__tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
