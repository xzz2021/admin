<script setup lang="ts">
import { updatePasswordApi } from '@/api/user'
import { Form, FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useValidator } from '@/hooks/web/useValidator'
import { useUserStore } from '@/store/modules/user'
import { ElDivider, ElMessage, ElMessageBox } from 'element-plus'
import { reactive, ref } from 'vue'

const userStore = useUserStore()
const { required } = useValidator()

const formSchema = reactive<FormSchema[]>([
  {
    field: 'password',
    label: '旧密码',
    component: 'InputPassword',
    colProps: {
      span: 24
    }
  },
  {
    field: 'newPassword',
    label: '新密码',
    component: 'InputPassword',
    colProps: {
      span: 24
    },
    componentProps: {
      strength: true
    }
  },
  {
    field: 'newPassword2',
    label: '确认新密码',
    component: 'InputPassword',
    colProps: {
      span: 24
    },
    componentProps: {
      strength: true
    }
  }
])

const { formRegister, formMethods } = useForm()
const { getFormData, getElFormExpose, setValues } = formMethods

const rules = reactive({
  password: [required()],
  newPassword: [
    required(),
    {
      asyncValidator: async (_, val, callback) => {
        const formData = await getFormData()
        const { newPassword2 } = formData
        if (val !== newPassword2) {
          callback(new Error('新密码与确认新密码不一致'))
        } else {
          callback()
        }
      }
    }
  ],
  newPassword2: [
    required(),
    {
      asyncValidator: async (_, val, callback) => {
        const formData = await getFormData()
        const { newPassword } = formData
        if (val !== newPassword) {
          callback(new Error('确认新密码与新密码不一致'))
        } else {
          callback()
        }
      }
    }
  ]
})

const saveLoading = ref(false)
const save = async () => {
  const userId = userStore.getUserInfo?.id
  if (!userId) {
    ElMessage.error('用户信息异常，请重新登录')
    return
  }

  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch((err) => {
    console.error(err)
  })
  if (!valid) return

  ElMessageBox.confirm('是否确认修改密码?', '提示', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      try {
        saveLoading.value = true
        const formData = await getFormData()
        await updatePasswordApi({
          id: userId,
          password: formData.password,
          newPassword: formData.newPassword
        })
        setValues({
          password: '',
          newPassword: '',
          newPassword2: ''
        })
        ElMessage.success('密码修改成功')
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
  <BaseButton type="primary" :loading="saveLoading" @click="save">确认修改</BaseButton>
</template>
