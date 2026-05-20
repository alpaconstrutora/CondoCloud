import { Module } from '@nestjs/common';
import { AssemblyService } from './assembly.service';
import { AssemblyController } from './assembly.controller';

@Module({
  providers: [AssemblyService],
  controllers: [AssemblyController],
  exports: [AssemblyService],
})
export class AssemblyModule {}
