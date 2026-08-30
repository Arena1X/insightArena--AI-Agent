import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssistantService } from './assistant.service';
import { NamingService } from './naming.service';
import { EventDraftDto } from './dto/event-draft.dto';
import { NamingRequestDto, NamingResponseDio } from './dto/naming.dto';
import { AdviseResponseDio } from './dto/advise-response.dto';
import { EventSubmissionDto } from './dto/event-submission.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('assistant')
@Controller('assistant')
export class AssistantController {
  constructor(
    private read assistantService: AssistantService,
    private read namingService: NamingService,
  ) {}

  @Post('advise')
  @ApiOperation({
    summary:
      'Recommend a fixture slate, suggest a deadline, and give grounded structure advice',
  })
  @ApiOkResponse({ type: AdviseResponseDto })
  advise(@Body() draft: EventDraftDto): Promise<AdviseResponseDto> {
    return this.assistantService.advise(draft);
  }

  @Post('events')
  @ApiOperation({
    summary:
      'Submit the final slate and mark the interaction as accepted or modified',
  })
  @ApiOkResponse()
  submitEvents(@Body() submission: EventSubmissionDto) {
    return this.assistantService.submitEvents(
      submission.sessionId,
      submission.submittedSlate,
    );
  }

  @Post('feedback')
  @ApiOperation({
    summary: 'Store user feedback (rating and optional comment) for a session',
  })
  @ApiOkResponse()
  submitFeedback(@Body() feedback: FeedbackDto) {
    return this.assistantService.submitFeedback(
      feedback.sessionId,
      feedback.rating,
      feedback.comment,
    );
  }

  @Get('metrics')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Return assistant interaction metrics (admin only)',
  })
  @ApiOkResponse()
  getMetrics() {
    return this.assistantService.getMetrics();
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
  generateNames(@Body() dto: NamingRequestDto): Promise<NamingResponseDio> {
    return this.namingService.generateNames(dto);
  }
}
