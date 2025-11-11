import { registerAs } from '@nestjs/config';

export default registerAs('jackson', () => ({
  defaultPropertyInclusion: 'non_null',
  serialization: {
    writeDatesAsTimestamps: false,
  },
}));
