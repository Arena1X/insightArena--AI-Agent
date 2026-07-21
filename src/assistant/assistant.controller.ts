import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { EventDraftDto } from './dto/event-draft.dto';
import { RecommendationResponseDto } from './dto/recommendation-response.dto';

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('advise')
  @ApiOperation({
    summary:
      'Recommend a fixture slate, suggest a deadline, and give grounded structure advice',
  })
  @ApiOkResponse({ type: RecommendationResponseDto })
  advise(@Body() draft: EventDraftDto): Promise<RecommendationResponseDto> {
    return this.assistantService.advise(draft);
  }
}
