import { RedisHealthService } from '@/core/cache/redis-health.service';
import { PgService } from '@/prisma/pg.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PgService,
          useValue: {},
        },
        {
          provide: RedisHealthService,
          useValue: {
            ping: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns the application greeting', () => {
      expect(appController.getHello()).toBe('Hello World!3333333333333');
    });
  });
});
