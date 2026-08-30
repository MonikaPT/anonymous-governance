import React, { useCallback, useEffect, useRef, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Backdrop,
  CircularProgress,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  IconButton,
  Skeleton,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import ShieldIcon from '@mui/icons-material/VerifiedUserOutlined';
import { type BBoardDerivedState, type DeployedBBoardAPI } from '../../../api/src/index';
import { useDeployedBoardContext } from '../hooks';
import { type BoardDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { ProposalState } from '../../../contract/src/managed/bboard/contract/index.js';
import { EmptyCardContent } from './Board.EmptyCardContent';

export interface BoardProps {
  boardDeployment$?: Observable<BoardDeployment>;
}

interface ClosedProposal {
  proposal: string;
  yesVotes: string;
  noVotes: string;
  closedAt: string;
  outcome: 'APPROVED' | 'REJECTED' | 'TIED';
}

const computeOutcome = (
  yes: string,
  no: string,
): 'APPROVED' | 'REJECTED' | 'TIED' => {
  try {
    const y = BigInt(yes);
    const n = BigInt(no);
    if (y > n) return 'APPROVED';
    if (n > y) return 'REJECTED';
    return 'TIED';
  } catch {
    return 'TIED';
  }
};

const outcomeColor = (outcome: 'APPROVED' | 'REJECTED' | 'TIED') => {
  if (outcome === 'APPROVED') return '#34d399';
  if (outcome === 'REJECTED') return '#f87171';
  return '#9ca3af';
};

export const Board: React.FC<Readonly<BoardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();

  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedBoardAPI, setDeployedBoardAPI] =
    useState<DeployedBBoardAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [boardState, setBoardState] = useState<BBoardDerivedState>();
  const [proposalPrompt, setProposalPrompt] = useState('');
  const [isWorking, setIsWorking] = useState(!!boardDeployment$);
  const [history, setHistory] = useState<ClosedProposal[]>([]);
  const [justClosed, setJustClosed] = useState<ClosedProposal | null>(null);
  const prevStateRef = useRef<BBoardDerivedState | undefined>(undefined);

  const onCreateBoard = useCallback(
    () => boardApiProvider.resolve(),
    [boardApiProvider],
  );

  const onJoinBoard = useCallback(
    (contractAddress: ContractAddress) =>
      boardApiProvider.resolve(contractAddress),
    [boardApiProvider],
  );

  const onCreateProposal = useCallback(async () => {
    if (!proposalPrompt.trim() || !deployedBoardAPI) return;

    try {
      setIsWorking(true);
      setJustClosed(null);
      await deployedBoardAPI.createProposal(proposalPrompt.trim());
      setProposalPrompt('');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI, proposalPrompt]);

  const onVoteYes = useCallback(async () => {
    if (!deployedBoardAPI) return;

    try {
      setIsWorking(true);
      await deployedBoardAPI.voteYes();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI]);

  const onVoteNo = useCallback(async () => {
    if (!deployedBoardAPI) return;

    try {
      setIsWorking(true);
      await deployedBoardAPI.voteNo();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI]);

  const onCloseProposal = useCallback(async () => {
    if (!deployedBoardAPI) return;

    try {
      setIsWorking(true);
      await deployedBoardAPI.closeProposal();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedBoardAPI]);

  const onCopyContractAddress = useCallback(async () => {
    if (deployedBoardAPI) {
      await navigator.clipboard.writeText(
        deployedBoardAPI.deployedContractAddress,
      );
    }
  }, [deployedBoardAPI]);

  useEffect(() => {
    if (!boardDeployment$) return;

    const subscription = boardDeployment$.subscribe(setBoardDeployment);

    return () => subscription.unsubscribe();
  }, [boardDeployment$]);

  useEffect(() => {
    if (!boardDeployment) return;

    if (boardDeployment.status === 'in-progress') return;

    setIsWorking(false);

    if (boardDeployment.status === 'failed') {
      setErrorMessage(
        boardDeployment.error.message.length
          ? boardDeployment.error.message
          : 'Encountered an unexpected error.',
      );
      return;
    }

    setDeployedBoardAPI(boardDeployment.api);

    const subscription = boardDeployment.api.state$.subscribe(setBoardState);

    return () => subscription.unsubscribe();
  }, [boardDeployment]);

  // Track when an active proposal transitions to closed, and archive it.
  useEffect(() => {
    if (!boardState) return;

    const prev = prevStateRef.current;

    if (
      prev &&
      prev.proposalState === ProposalState.ACTIVE &&
      boardState.proposalState !== ProposalState.ACTIVE
    ) {
      const yesVotes = prev.yesVotes.toString();
      const noVotes = prev.noVotes.toString();

      const closed: ClosedProposal = {
        proposal: prev.proposal ?? '',
        yesVotes,
        noVotes,
        closedAt: new Date().toLocaleString(),
        outcome: computeOutcome(yesVotes, noVotes),
      };

      setJustClosed(closed);
      setHistory((h) => [closed, ...h]);
    }

    prevStateRef.current = boardState;
  }, [boardState]);

  if (!boardDeployment$) {
    return (
      <Card
        sx={{
          width: 360,
          minWidth: 360,
          borderRadius: 4,
        }}
      >
        <EmptyCardContent
          onCreateBoardCallback={onCreateBoard}
          onJoinBoardCallback={onJoinBoard}
        />
      </Card>
    );
  }

  const isActive =
    boardState?.proposalState === ProposalState.ACTIVE;

  const isOwner = boardState?.isOwner ?? false;

  return (
    <Card
      sx={{
        width: 420,
        minWidth: 420,
        borderRadius: 4,
        background: '#111827',
        color: 'white',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      }}
    >
      <Backdrop
        sx={{
          position: 'absolute',
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
        open={isWorking}
      >
        <CircularProgress />
      </Backdrop>

      <Backdrop
        sx={{
          position: 'absolute',
          color: '#ff4444',
          zIndex: (theme) => theme.zIndex.drawer + 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
        open={!!errorMessage}
        onClick={() => setErrorMessage(undefined)}
      >
        <StopIcon fontSize="large" />
        <Typography>{errorMessage}</Typography>
        <Typography variant="caption">
          Click to dismiss
        </Typography>
      </Backdrop>

      <CardHeader
        avatar={
          isActive ? (
            <LockIcon sx={{ color: '#fbbf24' }} />
          ) : (
            <LockOpenIcon sx={{ color: '#34d399' }} />
          )
        }
        title={
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Anonymous Governance
          </Typography>
        }
        subheader={
          deployedBoardAPI ? (
            <Typography
              variant="caption"
              sx={{ color: '#9ca3af' }}
            >
              {toShortFormatContractAddress(
                deployedBoardAPI.deployedContractAddress,
              )}
            </Typography>
          ) : (
            <Skeleton width={120} />
          )
        }
        action={
          deployedBoardAPI?.deployedContractAddress ? (
            <IconButton
              title="Copy contract address"
              onClick={onCopyContractAddress}
              sx={{ color: 'white' }}
            >
              <CopyIcon />
            </IconButton>
          ) : null
        }
      />

      <CardContent>
        <Stack spacing={2.5}>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              Proposal status
            </Typography>

            <Chip
              label={isActive ? 'ACTIVE' : 'CLOSED'}
              size="small"
              sx={{
                fontWeight: 700,
                color: 'white',
                background: isActive ? '#2563eb' : '#374151',
              }}
            />
          </Stack>

          <Divider sx={{ borderColor: '#374151' }} />

          {boardState ? (
            isActive ? (
              <>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, lineHeight: 1.4 }}
                >
                  {boardState.proposal}
                </Typography>

                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ width: '100%' }}
                >
                  <Card
                    sx={{
                      flex: 1,
                      p: 2,
                      background: '#064e3b',
                      color: 'white',
                    }}
                  >
                    <Typography variant="caption">
                      YES VOTES
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }} >
                      {boardState.yesVotes.toString()}
                    </Typography>
                  </Card>

                  <Card
                    sx={{
                      flex: 1,
                      p: 2,
                      background: '#7f1d1d',
                      color: 'white',
                    }}
                  >
                    <Typography variant="caption">
                      NO VOTES
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }} >
                      {boardState.noVotes.toString()}
                    </Typography>
                  </Card>
                </Stack>

                <Stack spacing={1.5}>
                  <Button
                    variant="contained"
                    onClick={onVoteYes}
                    fullWidth
                    sx={{
                      py: 1.3,
                      fontWeight: 700,
                      background: '#059669',
                    }}
                  >
                    Vote YES
                  </Button>

                  <Button
                    variant="contained"
                    onClick={onVoteNo}
                    fullWidth
                    sx={{
                      py: 1.3,
                      fontWeight: 700,
                      background: '#dc2626',
                    }}
                  >
                    Vote NO
                  </Button>

                  {isOwner && (
                    <Button
                      variant="outlined"
                      onClick={onCloseProposal}
                      fullWidth
                      sx={{
                        py: 1.2,
                        color: 'white',
                        borderColor: '#6b7280',
                      }}
                    >
                      Close Proposal
                    </Button>
                  )}
                </Stack>
              </>
            ) : (
              <>
                {justClosed && (
                  <Card
                    sx={{
                      p: 2,
                      background: '#1f2937',
                      color: 'white',
                      border: '1px solid #374151',
                    }}
                  >
                    <Typography variant="overline" sx={{ color: '#9ca3af' }}>
                      Proposal Closed — Final Result
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5, mb: 1.5 }}>
                      {justClosed.proposal}
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
                      <Typography variant="body2" sx={{ color: '#34d399', fontWeight: 700 }}>
                        ✓ YES — {justClosed.yesVotes}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#f87171', fontWeight: 700 }}>
                        ✕ NO — {justClosed.noVotes}
                      </Typography>
                    </Stack>
                    <Chip
                      label={`OUTCOME: ${justClosed.outcome}`}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        color: '#0b1220',
                        background: outcomeColor(justClosed.outcome),
                      }}
                    />
                  </Card>
                )}

                <Typography
                  variant="h6"
                  sx={{ color: '#d1d5db' }}
                >
                  No active proposal
                </Typography>

                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  placeholder="Enter a proposal for the community..."
                  value={proposalPrompt}
                  onChange={(e) => setProposalPrompt(e.target.value)}
                  sx={{
                    '& .MuiInputBase-root': {
                      color: 'white',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#4b5563',
                    },
                  }}
                />

                <Button
                  variant="contained"
                  onClick={onCreateProposal}
                  disabled={!proposalPrompt.trim()}
                  fullWidth
                  sx={{
                    py: 1.3,
                    fontWeight: 700,
                  }}
                >
                  Create Anonymous Proposal
                </Button>
              </>
            )
          ) : (
            <Skeleton variant="rectangular" height={260} />
          )}

          {history.length > 0 && (
            <>
              <Divider sx={{ borderColor: '#374151', mt: 1 }} />
              <Typography variant="body2" sx={{ color: '#9ca3af', fontWeight: 700, letterSpacing: 1 }}>
                GOVERNANCE HISTORY
              </Typography>
              <Stack spacing={1.5}>
                {history.map((h, idx) => (
                  <Card
                    key={idx}
                    sx={{ p: 1.5, background: '#1f2937', color: 'white' }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, pr: 1 }}>
                        {h.proposal}
                      </Typography>
                      <Chip
                        label={h.outcome}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          color: '#0b1220',
                          background: outcomeColor(h.outcome),
                        }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: '#34d399' }}>
                        YES: {h.yesVotes}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#f87171' }}>
                        NO: {h.noVotes}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      Closed {h.closedAt}
                    </Typography>
                  </Card>
                ))}
              </Stack>
            </>
          )}

          <Divider sx={{ borderColor: '#374151', mt: 1 }} />

          <Card
            sx={{
              p: 2,
              background: '#0f172a',
              color: 'white',
              border: '1px solid #1e3a8a',
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
              <ShieldIcon sx={{ color: '#60a5fa' }} fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#93c5fd' }}>
                Privacy by Design
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              Your individual vote is not tied to a voter identity in the
              governance ledger. Midnight's privacy-preserving infrastructure
              allows governance actions to be processed without exposing
              your wallet identity alongside the vote. The same mechanism
              can power anonymous voting, community polls, or confidential
              misconduct reporting — anywhere people need to be heard
              without being identified.
            </Typography>
          </Card>
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Typography
          variant="caption"
          sx={{ color: '#6b7280' }}
        >
          Your identity stays private.
        </Typography>
      </CardActions>
    </Card>
  );
};

const toShortFormatContractAddress = (
  contractAddress: ContractAddress | undefined,
): React.ReactElement | undefined =>
  contractAddress ? (
    <span>
      0x
      {contractAddress.replace(
        /^[A-Fa-f0-9]{6}([A-Fa-f0-9]{8}).*([A-Fa-f0-9]{8})$/,
        '$1...$2',
      )}
    </span>
  ) : undefined;
