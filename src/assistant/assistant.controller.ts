import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { NamingService } from './naming.service';
import { EventDraftDto } from './dto/event-draft.dto';
import { RecommendationResponseDto } from './dto/recommendation-response.dto';
import { NamingRequestDto, NamingResponseDto } from './dto/naming.dto';

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly namingService: NamingService,
  ) {}

  @Post('advise')
  @ApiOperation({
    summary:
      'Recommend a fixture slate, suggest a deadline, and give grounded structure advice',
  })
  @ApiOkResponse({ type: RecommendationResponseDto })
  advise(@Body() draft: EventDraftDto): Promise<RecommendationResponseDto> {
    return this.assistantService.advise(draft);
  }

  @Post('naming')
  @ApiOperation({
    summary:
      'Generate catchy title candidates (≤ 40 chars) and a description (≤ 200 chars) for a fixture slate',
    description:
      'Accepts a free-text slate summary and returns 3 title candidates plus one event description. ' +
      'Results are cached by slate hash for 24 hours — identical requests cost zero LLM calls. ' +
      'Falls back to deterministic titles if the LLM is unavailable.',
  })
  @ApiOkResponse({ type: NamingResponseDto })
  generateNames(@Body() dto: NamingRequestDto): Promise<NamingResponseDto> {
    return this.namingService.generateNames(dto);
  }
}
