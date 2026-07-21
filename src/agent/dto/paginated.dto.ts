import { ApiProperty } from '@nestjs/swagger';

export class PaginatedDto<TData> {
  @ApiProperty({
    description: 'List of items for the current page',
    isArray: true,
  })
  items: TData[];

  @ApiProperty({
    description: 'Total number of items available',
    example: 100,
    type: Number,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
    type: Number,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    type: Number,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
    type: Number,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrevious: boolean;
}
