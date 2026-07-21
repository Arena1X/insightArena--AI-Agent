import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { AgentService } from './agent.service';
import {
  AnalyzeMarketDto,
  AnalysisResultDto,
  CreatePredictionDto,
  PredictionResultDto,
  AgentStatusDto,
  CoachAdviceRequestDto,
  CoachAdviceResponseDto,
  LeaderboardInsightDto,
  ApiErrorDto,
} from './dto';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Analyze a prediction market',
    description:
      'Performs a comprehensive AI-driven analysis of a prediction market, considering multiple factors such as team form, historical data, and market conditions to generate a confidence score and recommendation.',
  })
  @ApiBody({ type: AnalyzeMarketDto })
  @ApiResponse({
    status: 200,
    description: 'Market analysis completed successfully',
    type: AnalysisResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
    type: ApiErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing API key',
  })
  @ApiResponse({
    status: 503,
    description: 'AI service unavailable',
    type: ApiErrorDto,
  })
  async analyze(@Body() dto: AnalyzeMarketDto): Promise<AnalysisResultDto> {
    return this.agentService.analyzeMarket(dto);
  }

  @Post('predict')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create an AI-powered prediction',
    description:
      'Submits an AI-generated prediction for a specified market, optionally linked to a pre-computed analysis. The agent will stake on behalf of the system if a stake amount is provided.',
  })
  @ApiBody({ type: CreatePredictionDto })
  @ApiResponse({
    status: 201,
    description: 'Prediction created successfully',
    type: PredictionResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
    type: ApiErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing API key',
  })
  @ApiResponse({
    status: 404,
    description: 'Market not found',
    type: ApiErrorDto,
  })
  async predict(@Body() dto: CreatePredictionDto): Promise<PredictionResultDto> {
    return this.agentService.createPrediction(dto);
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get agent operational status',
    description:
      'Returns the current operational status of the AI agent, including connectivity to AI models, blockchain, oracles, and database. Provides capability-level health checks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent status retrieved successfully',
    type: AgentStatusDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing API key',
  })
  async getStatus(): Promise<AgentStatusDto> {
    return this.agentService.getStatus();
  }

  @Post('coach')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get personalized coaching advice',
    description:
      'Generates personalized performance insights and strategic advice for a user based on their prediction history, accuracy trends, and market participation patterns.',
  })
  @ApiBody({ type: CoachAdviceRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Coaching advice generated successfully',
    type: CoachAdviceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
    type: ApiErrorDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing API key',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ApiErrorDto,
  })
  async coach(@Body() dto: CoachAdviceRequestDto): Promise<CoachAdviceResponseDto> {
    return this.agentService.getCoachAdvice(dto);
  }

  @Get('leaderboard/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get leaderboard insights for a user',
    description:
      'Retrieves leaderboard ranking and performance insights for a specific user, including their current rank, rank trend, and comparison with top participants.',
  })
  @ApiParam({
    name: 'userId',
    description: 'The unique identifier of the user',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @ApiQuery({
    name: 'type',
    description: 'Leaderboard type to query',
    required: false,
    example: 'global',
    enum: ['global', 'weekly', 'monthly'],
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of top entries to include',
    required: false,
    example: 10,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard insights retrieved successfully',
    type: LeaderboardInsightDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing API key',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found on leaderboard',
    type: ApiErrorDto,
  })
  async getLeaderboardInsights(
    @Param('userId') userId: string,
    @Query('type') type?: string,
    @Query('limit') limit?: number,
  ): Promise<LeaderboardInsightDto> {
    return this.agentService.getLeaderboardInsights(userId, type, limit);
  }
}
