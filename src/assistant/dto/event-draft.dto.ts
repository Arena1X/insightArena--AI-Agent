import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { FixtureDto } from './fixture.dto';

/**
 * The draft of a custom event a creator is building. This is the primary
 * input to the Creator Assistant: it describes the group and the pool of
 * candidate fixtures the creator is considering.
 */
export class EventDraftDto {
  @ApiProperty({ example: 'Friday Night Footy' })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'private',
    enum: ['public', 'private'],
    description: 'Whether the event is open to the public or invite-only',
  })
  @IsIn(['public', 'private'])
  visibility: 'public' | 'private';

  @ApiProperty({
    example: 12,
    description: 'Expected number of participants',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  expectedParticipants?: number;

  @ApiProperty({
    example: 5,
    description: 'How many fixtures the creator wants in the final event',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  desiredFixtureCount?: number;

  @ApiProperty({
    type: [FixtureDto],
    description: 'Pool of candidate fixtures under consideration',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FixtureDto)
  candidateFixtures: FixtureDto[];
}
