import { Module } from '@nestjs/common';
import { TipoMoradorController } from './tipo-morador.controller';
import { TipoMoradorService } from './tipo-morador.service';

@Module({
  controllers: [TipoMoradorController],
  providers: [TipoMoradorService],
})
export class TipoMoradorModule {}
