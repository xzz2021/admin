<script lang="ts" setup>
import { updatePersonApi } from '@/api/user'
import type { PersonalUserDetail } from '@/api/user/types'
import { Form, FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useValidator } from '@/hooks/web/useValidator'
import { ElDivider, ElMessage, ElMessageBox } from 'element-plus'
import { PropType, reactive, ref, watch } from 'vue'

const props = defineProps({
  userInfo: {
    type: Object as PropType<PersonalUserDetail | undefined>,
    default: () => undefined
  }
})

const emit = defineEmits<{
  success: []
}>()

const { required, phone, maxlength, email } = useValidator()

const formSchema = reactive<FormSchema[]>([
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    colProps: {
      span: 24
    }
  },
  {
    field: 'phone',
    label: '手机号码',
    component: 'Input',
    colProps: {
      span: 24
    }
  },
  {
    field: 'email',
    label: '邮箱',
    component: 'Input',
    colProps: {
      span: 24
    }
  }
])

const rules = reactive({
  username: [required(), maxlength(50)],
  phone: [required(), phone()],
  email: [email()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose } = formMethods

watch(
  () => props.userInfo,
  (value) => {
    if (!value) return
    setValues({
      username: value.username ?? '',
      phone: value.phone ?? '',
      email: value.email ?? ''
    })
  },
  {
    immediate: true,
    deep: true
  }
)

const saveLoading = ref(false)
const save = async () => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch((err) => {
    console.error(err)
  })
  if (!valid || !props.userInfo?.id) return

  ElMessageBox.confirm('是否确认修改?', '提示', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      try {
        saveLoading.value = true
        const formData = await getFormData()
        await updatePersonApi({
          id: props.userInfo!.id,
          username: formData.username,
          phone: formData.phone,
          email: formData.email || undefined
        })
        ElMessage.success('修改成功')
        emit('success')
      } catch (error) {
        console.error(error)
      } finally {
        saveLoading.value = false
      }
    })
    .catch(() => {})
}
</script>

<template>
  <Form :rules="rules" @register="formRegister" :schema="formSchema" />
  <ElDivider />
  <BaseButton type="primary" :loading="saveLoading" @click="save">保存</BaseButton>
</template>
