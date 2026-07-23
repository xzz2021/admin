<script setup lang="ts">
import { addRoleApi, editRoleApi, getRoleListApi, getRoleMenuAndPermissionApi } from '@/api/role'
import { ContentWrap } from '@/components/ContentWrap'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AssignMenuPermissionPanel, { type RoleFormModel } from './components/AssignMenuPermissionPanel.vue'

const route = useRoute()
const router = useRouter()

const panelRef = ref<InstanceType<typeof AssignMenuPermissionPanel>>()
const loading = ref(false)
const saveLoading = ref(false)
const menuTree = ref<any[]>([])
const pageKey = ref(0)

const roleForm = reactive<RoleFormModel>({
  name: '',
  code: '',
  enabled: true,
  description: ''
})

const roleId = computed(() => route.params.id as string | undefined)

const fillRoleForm = (role: Partial<RoleFormModel>) => {
  Object.assign(roleForm, {
    id: role.id || roleId.value,
    name: role.name || '',
    code: role.code || '',
    enabled: role.enabled ?? true,
    description: role.description || ''
  })
}

const loadRoleBasicInfo = async () => {
  const roleFromState = history.state?.role as Partial<RoleFormModel> | undefined
  if (roleFromState?.name) {
    fillRoleForm(roleFromState)
    return
  }

  if (!roleId.value) return

  const res = await getRoleListApi({ pageIndex: 1, pageSize: 500 })
  const role = res.data.list?.find((item) => item.id === roleId.value)
  if (role) {
    fillRoleForm(role)
  }
}

const initPage = async () => {
  loading.value = true
  try {
    if (roleId.value) {
      await loadRoleBasicInfo()
      const res = await getRoleMenuAndPermissionApi(roleId.value)
      menuTree.value = res.data.list || []
    } else {
      const res = await getRoleMenuAndPermissionApi('__new__')
      menuTree.value = res.data.list || []
    }
    pageKey.value += 1
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.back()
}

const handleSave = async () => {
  if (!roleForm.name?.trim()) {
    ElMessage.warning('请输入角色名称')
    return
  }
  if (!roleForm.code?.trim()) {
    ElMessage.warning('请输入角色编码')
    return
  }

  const submitData = panelRef.value?.collectSubmitData()
  if (!submitData) return

  if (!submitData.menus.length) {
    ElMessage.warning('请至少选择一个菜单')
    return
  }

  saveLoading.value = true
  try {
    if (roleId.value) {
      await editRoleApi({ ...submitData, id: roleId.value })
      ElMessage.success('保存成功')
    } else {
      await addRoleApi(submitData)
      ElMessage.success('新增成功')
    }
    router.push({ name: 'Role', state: { refresh: true } })
  } catch (error) {
    console.error(error)
    ElMessage.error('保存失败')
  } finally {
    saveLoading.value = false
  }
}

onMounted(() => {
  initPage()
})
</script>

<template>
  <ContentWrap>
    <AssignMenuPermissionPanel
      :key="`${roleId || 'new'}-${pageKey}`"
      ref="panelRef"
      v-model:role-form="roleForm"
      :menu-tree="menuTree"
      :loading="loading"
      :save-loading="saveLoading"
      @cancel="handleCancel"
      @save="handleSave"
    />
  </ContentWrap>
</template>
