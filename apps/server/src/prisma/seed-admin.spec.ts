import { verify } from 'argon2'
import { createSeedAdmin } from './seed-admin'

describe('createSeedAdmin', () => {
  it('rejects missing or weak initial administrator credentials', async () => {
    await expect(createSeedAdmin({})).rejects.toThrow('首次初始化需要有效的')
    await expect(
      createSeedAdmin({
        SEED_ADMIN_USERNAME: 'admin',
        SEED_ADMIN_PASSWORD: '1234',
        SEED_ADMIN_PHONE: '13800138000',
      }),
    ).rejects.toThrow('首次初始化需要有效的')
  })

  it('hashes valid administrator credentials at runtime', async () => {
    const password = 'a-secure-random-password'
    const admin = await createSeedAdmin({
      SEED_ADMIN_USERNAME: 'admin',
      SEED_ADMIN_PASSWORD: password,
      SEED_ADMIN_PHONE: '13800138000',
    })

    expect(admin).toMatchObject({
      username: 'admin',
      phone: '13800138000',
    })
    expect(admin.password).not.toBe(password)
    await expect(verify(admin.password, password)).resolves.toBe(true)
  })
})
