import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Result } from '@lab/shared'
import { AccountDTO, CreateAccount } from '@lab/accounts'
import { AccountsPrisma } from './accounts.prisma.js'

interface CreateAccountBody {
  userId: string
  name: string
  type: string
  initialBalance?: number
}

function unwrap<T>(result: Result<T>): T {
  if (result.isFailure) throw new BadRequestException(result.errors)
  return result.instance
}

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsPrisma) {}

  @Get()
  async list(@Query('userId') userId: string): Promise<AccountDTO[]> {
    return unwrap(await this.accounts.findByUserId(userId))
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: CreateAccountBody): Promise<AccountDTO> {
    const id = unwrap(await new CreateAccount(this.accounts).execute(body))
    return unwrap(await this.accounts.findById(body.userId, id))
  }

  @Get(':id')
  async get(@Query('userId') userId: string, @Param('id') id: string): Promise<AccountDTO> {
    return unwrap(await this.accounts.findById(userId, id))
  }
}
