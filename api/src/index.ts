import * as Governance from '../../contract/src/managed/bboard/contract/index.js';

import {
  type ContractAddress,
  convertFieldToBytes,
} from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';

import { type Logger } from 'pino';

import {
  type BBoardProviders,
  type DeployedBBoardContract,
  type BBoardDerivedState,
  bboardPrivateStateKey,
} from './common-types.js';

import { CompiledBBoardContractContract } from '../../contract/src/index';

import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

import { combineLatest, from, map, type Observable } from 'rxjs';

import { toHex } from '@midnight-ntwrk/midnight-js-utils';

import {
  BBoardPrivateState,
  createBBoardPrivateState,
} from '../../contract/src/witnesses.js';

export interface DeployedBBoardAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<BBoardDerivedState>;

  createProposal: (proposal: string) => Promise<void>;
  voteYes: () => Promise<void>;
  voteNo: () => Promise<void>;
  closeProposal: () => Promise<void>;
}

export class BBoardAPI implements DeployedBBoardAPI {
  private constructor(
    public readonly deployedContract: DeployedBBoardContract,
    providers: BBoardProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress =
      deployedContract.deployTxData.public.contractAddress;

    providers.privateStateProvider.setContractAddress(
      this.deployedContractAddress,
    );

    this.state$ = combineLatest([
      providers.publicDataProvider
        .contractStateObservable(this.deployedContractAddress, {
          type: 'latest',
        })
        .pipe(
          map((contractState) => Governance.ledger(contractState.data)),
        ),

      from(
        providers.privateStateProvider.get(
          bboardPrivateStateKey,
        ) as Promise<BBoardPrivateState>,
      ),
    ]).pipe(
      map(([ledgerState, privateState]) => {
        const hashedSecretKey = Governance.pureCircuits.publicKey(
          privateState.secretKey,
          convertFieldToBytes(
            32,
            ledgerState.sequence,
            'api/src/index.ts',
          ),
        );

        return {
          proposalState: ledgerState.proposalState,
          proposal: ledgerState.proposal.is_some ? ledgerState.proposal.value : undefined,
          yesVotes: ledgerState.yesVotes,
          noVotes: ledgerState.noVotes,
          sequence: ledgerState.sequence,
          isOwner:
            toHex(ledgerState.owner) ===
            toHex(hashedSecretKey),
        };
      }),
    );
  }

  readonly deployedContractAddress: ContractAddress;

  readonly state$: Observable<BBoardDerivedState>;

  async createProposal(proposal: string): Promise<void> {
    this.logger?.info(`creatingProposal: ${proposal}`);

    await this.deployedContract.callTx.createProposal(
      proposal,
    );
  }

  async voteYes(): Promise<void> {
    this.logger?.info('votingYes');

    await this.deployedContract.callTx.voteYes();
  }

  async voteNo(): Promise<void> {
    this.logger?.info('votingNo');

    await this.deployedContract.callTx.voteNo();
  }

  async closeProposal(): Promise<void> {
    this.logger?.info('closingProposal');

    await this.deployedContract.callTx.closeProposal();
  }

  static async deploy(
    providers: BBoardProviders,
    logger?: Logger,
  ): Promise<BBoardAPI> {
    logger?.info('deployContract');

    const deployedBBoardContract = await deployContract(providers, {
      compiledContract: CompiledBBoardContractContract,
      privateStateId: bboardPrivateStateKey,
      initialPrivateState: createBBoardPrivateState(
        new Uint8Array(32),
      ),
    });

    return new BBoardAPI(
      deployedBBoardContract,
      providers,
      logger,
    );
  }

  static async join(
    providers: BBoardProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<BBoardAPI> {
    const deployedBBoardContract =
      await findDeployedContract(providers, {
        contractAddress,
        compiledContract: CompiledBBoardContractContract,
        privateStateId: bboardPrivateStateKey,
        initialPrivateState:
          await BBoardAPI.getPrivateState(
            providers,
            contractAddress,
          ),
      });

    return new BBoardAPI(
      deployedBBoardContract,
      providers,
      logger,
    );
  }

  private static async getPrivateState(
    providers: BBoardProviders,
    contractAddress: ContractAddress,
  ): Promise<BBoardPrivateState> {
    providers.privateStateProvider.setContractAddress(
      contractAddress,
    );

    const existingPrivateState =
      await providers.privateStateProvider.get(
        bboardPrivateStateKey,
      );

    return (
      existingPrivateState ??
      createBBoardPrivateState(new Uint8Array(32))
    );
  }
}

export * as utils from './utils/index.js';

export * from './common-types.js';
