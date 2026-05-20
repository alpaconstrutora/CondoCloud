import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@condocloud/shared';

const logger = new Logger('RedisModule');
const queueNames = Object.values(QUEUE_NAMES);

@Global()
@Module({})
export class RedisModule {
  static forRootAsync(): DynamicModule {
    const redisUrl = process.env['REDIS_URL'];

    if (!redisUrl) {
      logger.warn('REDIS_URL não configurado — filas desativadas');
      return { module: RedisModule, imports: [], exports: [] };
    }

    return {
      module: RedisModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            redis: configService.get<string>('REDIS_URL'),
            // Opções para evitar crash quando Redis está indisponível
            settings: {
              maxStalledCount: 1,
            },
            defaultJobOptions: {
              attempts: 3,
              removeOnComplete: true,
              removeOnFail: false,
            },
            createClient: () => {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const Redis = require('ioredis');
              const client = new Redis(configService.get<string>('REDIS_URL'), {
                enableReadyCheck: false,
                maxRetriesPerRequest: null,
                lazyConnect: true,
                retryStrategy: (times: number) => {
                  if (times > 10) {
                    logger.error('Redis indisponível após 10 tentativas — filas pausadas');
                    return null; // para de tentar reconectar
                  }
                  return Math.min(times * 500, 5000);
                },
              });
              client.on('error', (err: Error) => {
                logger.warn(`Redis: ${err.message}`);
              });
              return client;
            },
          }),
        }),
        BullModule.registerQueue(
          ...queueNames.map((name) => ({ name }))
        ),
      ],
      exports: [BullModule],
    };
  }
}
