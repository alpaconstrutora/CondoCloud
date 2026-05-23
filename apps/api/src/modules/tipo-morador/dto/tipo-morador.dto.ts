import { IsString, MinLength } from 'class-validator';

export class CreateTipoMoradorDto {
  @IsString()
  @MinLength(1)
  nome!: string;
}

export class UpdateTipoMoradorDto {
  @IsString()
  @MinLength(1)
  nome!: string;
}
