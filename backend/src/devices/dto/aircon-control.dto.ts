import { IsIn, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class AirconControlDto {
  @IsOptional()
  @IsIn(['on', 'off'])
  power?: 'on' | 'off';

  @IsOptional()
  @IsNumber()
  @Min(16)
  @Max(31)
  temperature?: number;

  @IsOptional()
  @IsIn(['off', 'heat_cool', 'cool', 'dry', 'heat', 'fan_only'])
  mode?: 'off' | 'heat_cool' | 'cool' | 'dry' | 'heat' | 'fan_only';

  @IsOptional()
  @IsIn(['AUTO', '1', '2', '3', '4', 'QUIET'])
  fan?: 'AUTO' | '1' | '2' | '3' | '4' | 'QUIET';

  @IsOptional()
  @IsIn(['AUTO', '1', '2', '3', '4', '5', 'SWING'])
  vane?: 'AUTO' | '1' | '2' | '3' | '4' | '5' | 'SWING';

  @IsOptional()
  @IsIn(['<<', '<', '|', '>', '>>', 'SWING'])
  wideVane?: '<<' | '<' | '|' | '>' | '>>' | 'SWING';
}
