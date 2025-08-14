import type { ClaudeHookData } from "../index";
import type { PowerlineColors } from "../themes";
import type { PowerlineConfig } from "../config/loader";

export interface SegmentConfig {
  enabled: boolean;
}

export interface GitSegmentConfig extends SegmentConfig {
  showSha: boolean;
}

export interface UsageSegmentConfig extends SegmentConfig {
  type: "cost" | "tokens" | "both" | "breakdown";
}

export interface TmuxSegmentConfig extends SegmentConfig {}

export interface ContextSegmentConfig extends SegmentConfig {}

export interface MetricsSegmentConfig extends SegmentConfig {
  showResponseTime?: boolean;
  showDuration?: boolean;
  showMessageCount?: boolean;
  showCostBurnRate?: boolean;
  showTokenBurnRate?: boolean;
}

export interface BlockSegmentConfig extends SegmentConfig {
  type: "cost" | "tokens" | "both" | "time";
}

export interface TodaySegmentConfig extends SegmentConfig {
  type: "cost" | "tokens" | "both" | "breakdown";
}

export type AnySegmentConfig =
  | SegmentConfig
  | GitSegmentConfig
  | UsageSegmentConfig
  | TmuxSegmentConfig
  | ContextSegmentConfig
  | MetricsSegmentConfig
  | BlockSegmentConfig
  | TodaySegmentConfig;

import {
  formatCost,
  formatTokens,
  formatTokenBreakdown,
} from "../utils/formatters";
import { getBudgetStatus } from "../utils/budget";
import type {
  UsageInfo,
  TokenBreakdown,
  GitInfo,
  ContextInfo,
  MetricsInfo,
} from ".";
import type { BlockInfo } from "./block";
import type { TodayInfo } from "./today";

export interface PowerlineSymbols {
  right: string;
  branch: string;
  model: string;
  git_clean: string;
  git_dirty: string;
  git_conflicts: string;
  git_ahead: string;
  git_behind: string;
  session_cost: string;
  block_cost: string;
  today_cost: string;
  context_time: string;
  metrics_response: string;
  metrics_duration: string;
  metrics_messages: string;
  metrics_burn: string;
}

export interface SegmentData {
  text: string;
  bgColor: string;
  fgColor: string;
}

export class SegmentRenderer {
  constructor(
    private readonly config: PowerlineConfig,
    private readonly symbols: PowerlineSymbols
  ) {}

  renderDirectory(
    hookData: ClaudeHookData,
    colors: PowerlineColors
  ): SegmentData {
    const currentDir = hookData.workspace?.current_dir || hookData.cwd || "/";
    const projectDir = hookData.workspace?.project_dir;
    const dirName = this.getDisplayDirectoryName(currentDir, projectDir);

    return {
      text: dirName,
      bgColor: colors.modeBg,
      fgColor: colors.modeFg,
    };
  }

  renderGit(
    gitInfo: GitInfo,
    colors: PowerlineColors,
    showSha = false
  ): SegmentData | null {
    if (!gitInfo) return null;

    let gitStatusIcon = this.symbols.git_clean;
    if (gitInfo.status === "conflicts") {
      gitStatusIcon = this.symbols.git_conflicts;
    } else if (gitInfo.status === "dirty") {
      gitStatusIcon = this.symbols.git_dirty;
    }

    let text = `${this.symbols.branch} ${gitInfo.branch} ${gitStatusIcon}`;

    if (gitInfo.sha && showSha) {
      text += ` ${gitInfo.sha}`;
    }

    if (gitInfo.ahead > 0 && gitInfo.behind > 0) {
      text += ` ${this.symbols.git_ahead}${gitInfo.ahead}${this.symbols.git_behind}${gitInfo.behind}`;
    } else if (gitInfo.ahead > 0) {
      text += ` ${this.symbols.git_ahead}${gitInfo.ahead}`;
    } else if (gitInfo.behind > 0) {
      text += ` ${this.symbols.git_behind}${gitInfo.behind}`;
    }

    return {
      text,
      bgColor: colors.gitBg,
      fgColor: colors.gitFg,
    };
  }

  renderModel(hookData: ClaudeHookData, colors: PowerlineColors): SegmentData {
    const modelName = hookData.model?.display_name || "Claude";

    return {
      text: `${this.symbols.model} ${modelName}`,
      bgColor: colors.modelBg,
      fgColor: colors.modelFg,
    };
  }

  renderSession(
    usageInfo: UsageInfo,
    colors: PowerlineColors,
    type = "cost"
  ): SegmentData {
    const sessionBudget = this.config.budget?.session;
    const text = `${this.symbols.session_cost} ${this.formatUsageWithBudget(
      usageInfo.session.cost,
      usageInfo.session.tokens,
      usageInfo.session.tokenBreakdown,
      type,
      sessionBudget?.amount,
      sessionBudget?.warningThreshold || 80
    )}`;

    return {
      text,
      bgColor: colors.sessionBg,
      fgColor: colors.sessionFg,
    };
  }

  renderTmux(
    sessionId: string | null,
    colors: PowerlineColors
  ): SegmentData | null {
    if (!sessionId) {
      return {
        text: `tmux:none`,
        bgColor: colors.tmuxBg,
        fgColor: colors.tmuxFg,
      };
    }

    return {
      text: `tmux:${sessionId}`,
      bgColor: colors.tmuxBg,
      fgColor: colors.tmuxFg,
    };
  }

  renderContext(
    contextInfo: ContextInfo | null,
    colors: PowerlineColors
  ): SegmentData | null {
    if (!contextInfo) {
      return {
        text: `${this.symbols.context_time} 0 (100%)`,
        bgColor: colors.contextBg,
        fgColor: colors.contextFg,
      };
    }

    const tokenDisplay = contextInfo.inputTokens.toLocaleString();

    const contextLeft = `${contextInfo.contextLeftPercentage}%`;

    return {
      text: `${this.symbols.context_time} ${tokenDisplay} (${contextLeft})`,
      bgColor: colors.contextBg,
      fgColor: colors.contextFg,
    };
  }

  renderMetrics(
    metricsInfo: MetricsInfo | null,
    colors: PowerlineColors,
    config?: MetricsSegmentConfig
  ): SegmentData | null {
    if (!metricsInfo) {
      return {
        text: `${this.symbols.metrics_response} new`,
        bgColor: colors.metricsBg,
        fgColor: colors.metricsFg,
      };
    }

    const parts: string[] = [];

    if (
      config?.showResponseTime !== false &&
      metricsInfo.responseTime !== null
    ) {
      const responseTime =
        metricsInfo.responseTime < 60
          ? `${metricsInfo.responseTime.toFixed(1)}s`
          : `${(metricsInfo.responseTime / 60).toFixed(1)}m`;
      parts.push(`${this.symbols.metrics_response} ${responseTime}`);
    }

    if (
      config?.showDuration !== false &&
      metricsInfo.sessionDuration !== null
    ) {
      const duration = this.formatDuration(metricsInfo.sessionDuration);
      parts.push(`${this.symbols.metrics_duration} ${duration}`);
    }

    if (
      config?.showMessageCount !== false &&
      metricsInfo.messageCount !== null
    ) {
      parts.push(
        `${this.symbols.metrics_messages} ${metricsInfo.messageCount}`
      );
    }

    if (config?.showCostBurnRate && metricsInfo.costBurnRate !== null) {
      const burnRate =
        metricsInfo.costBurnRate < 1
          ? `${(metricsInfo.costBurnRate * 100).toFixed(0)}¢/h`
          : `$${metricsInfo.costBurnRate.toFixed(2)}/h`;
      parts.push(`${this.symbols.metrics_burn} ${burnRate}`);
    }

    if (config?.showTokenBurnRate && metricsInfo.tokenBurnRate !== null) {
      const tokenRate = formatTokens(Math.round(metricsInfo.tokenBurnRate));
      parts.push(`${this.symbols.metrics_burn} ${tokenRate}/h`);
    }

    if (parts.length === 0) {
      return {
        text: `${this.symbols.metrics_response} active`,
        bgColor: colors.metricsBg,
        fgColor: colors.metricsFg,
      };
    }

    return {
      text: parts.join(" "),
      bgColor: colors.metricsBg,
      fgColor: colors.metricsFg,
    };
  }

  renderBlock(
    blockInfo: BlockInfo,
    colors: PowerlineColors,
    type = "cost"
  ): SegmentData {
    let displayText: string;

    if (blockInfo.cost === null && blockInfo.tokens === null) {
      displayText = "No active block";
    } else {
      // Always include time remaining when available
      const timeStr = blockInfo.timeRemaining !== null 
        ? (() => {
            const hours = Math.floor(blockInfo.timeRemaining / 60);
            const minutes = blockInfo.timeRemaining % 60;
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          })()
        : null;

      switch (type) {
        case "cost":
          displayText = timeStr 
            ? `${formatCost(blockInfo.cost)} (${timeStr} left)`
            : formatCost(blockInfo.cost);
          break;
        case "tokens":
          displayText = timeStr
            ? `${formatTokens(blockInfo.tokens)} (${timeStr} left)`
            : formatTokens(blockInfo.tokens);
          break;
        default:
          // Default to cost display
          displayText = timeStr 
            ? `${formatCost(blockInfo.cost)} (${timeStr} left)`
            : formatCost(blockInfo.cost);
      }
    }

    return {
      text: `${this.symbols.block_cost} ${displayText}`,
      bgColor: colors.blockBg,
      fgColor: colors.blockFg,
    };
  }

  renderToday(
    todayInfo: TodayInfo,
    colors: PowerlineColors,
    type = "cost"
  ): SegmentData {
    const todayBudget = this.config.budget?.today;
    const text = `${this.symbols.today_cost} ${this.formatUsageWithBudget(
      todayInfo.cost,
      todayInfo.tokens,
      todayInfo.tokenBreakdown,
      type,
      todayBudget?.amount,
      todayBudget?.warningThreshold
    )}`;

    return {
      text,
      bgColor: colors.todayBg,
      fgColor: colors.todayFg,
    };
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(0)}s`;
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(0)}m`;
    } else if (seconds < 86400) {
      return `${(seconds / 3600).toFixed(1)}h`;
    } else {
      return `${(seconds / 86400).toFixed(1)}d`;
    }
  }

  private getDisplayDirectoryName(
    currentDir: string,
    projectDir?: string
  ): string {
    if (projectDir && projectDir !== currentDir) {
      if (currentDir.startsWith(projectDir)) {
        const relativePath = currentDir.slice(projectDir.length + 1);
        return relativePath || projectDir.split("/").pop() || "project";
      }
      return currentDir.split("/").pop() || "root";
    }

    return currentDir.split("/").pop() || "root";
  }

  private formatUsageDisplay(
    cost: number | null,
    tokens: number | null,
    tokenBreakdown: TokenBreakdown | null,
    type: string
  ): string {
    switch (type) {
      case "cost":
        return formatCost(cost);
      case "tokens":
        return formatTokens(tokens);
      case "both":
        return `${formatCost(cost)} (${formatTokens(tokens)})`;
      case "breakdown":
        return formatTokenBreakdown(tokenBreakdown);
      default:
        return formatCost(cost);
    }
  }

  private formatUsageWithBudget(
    cost: number | null,
    tokens: number | null,
    tokenBreakdown: TokenBreakdown | null,
    type: string,
    budget: number | undefined,
    warningThreshold = 80
  ): string {
    const baseDisplay = this.formatUsageDisplay(
      cost,
      tokens,
      tokenBreakdown,
      type
    );

    if (budget && budget > 0 && cost !== null) {
      const budgetStatus = getBudgetStatus(cost, budget, warningThreshold);
      return baseDisplay + budgetStatus.displayText;
    }

    return baseDisplay;
  }
}
