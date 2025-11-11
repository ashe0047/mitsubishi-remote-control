import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SetDevicePowerDto {
  @IsNotEmpty()
  @IsIn(['on', 'off'])
  power!: 'on' | 'off';
}

export class SetDeviceTemperatureDto {
  @IsNotEmpty()
  @IsIn(['heat', 'cool'])
  mode!: 'heat' | 'cool';

  @IsNotEmpty()
  temperature!: number;
}

export class SetDeviceModeDto {
  @IsNotEmpty()
  @IsIn(['off', 'auto', 'cool', 'dry', 'heat', 'fan_only'])
  mode!: 'off' | 'auto' | 'cool' | 'dry' | 'heat' | 'fan_only';
}

export class SetDeviceFanSpeedDto {
  @IsNotEmpty()
  @IsIn(['AUTO', '1', '2', '3', '4', '5', 'QUIET'])
  fan!: 'AUTO' | '1' | '2' | '3' | '4' | '5' | 'QUIET';
}

export class SetDeviceVaneDto {
  @IsNotEmpty()
  @IsIn(['AUTO', '1', '2', '3', '4', '5', 'SWING'])
  vane!: 'AUTO' | '1' | '2' | '3' | '4' | '5' | 'SWING';
}

export class SetDeviceWideVaneDto {
  @IsNotEmpty()
  @IsIn(['<<', '<', '|', '>', '>>', 'SWING'])
  wideVane!: '<<' | '<' | '|' | '>' | '>>' | 'SWING';
}
