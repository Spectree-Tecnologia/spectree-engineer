import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { Result } from '@lab/shared'
import { AccountDTO, CreateAccount } from '@lab/accounts'
import { CurrentUser } from '../../shared/decorators/current-user.decorator.js'
import { AccountsPrisma } from './accounts.prisma.js'

interface CreateAccountBody {
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
  async list(@CurrentUser('id') userId: string): Promise<AccountDTO[]> {
    return unwrap(await this.accounts.findByUserId(userId))
  }

  @Post()
  @HttpCode(201)
  async create(@CurrentUser('id') userId: string, @Body() body: CreateAccountBody): Promise<AccountDTO> {
    const id = unwrap(await new CreateAccount(this.accounts).execute({ ...body, userId }))
    return unwrap(await this.accounts.findById(userId, id))
  }

  @Get(':id')
  async get(@CurrentUser('id') userId: string, @Param('id') id: string): Promise<AccountDTO> {
    return unwrap(await this.accounts.findById(userId, id))
  }
}
