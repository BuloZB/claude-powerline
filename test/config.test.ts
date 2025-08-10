import fs from "node:fs";
import os from "node:os";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import {
  loadConfig,
  loadConfigFromCLI,
  getDefaultConfigJSON,
} from "../src/config/loader";

jest.mock("node:fs");
jest.mock("node:os");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe("config", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.homedir.mockReturnValue("/home/user");
    jest.spyOn(process, "cwd").mockReturnValue("/project");
  });

  describe("DEFAULT_CONFIG", () => {
    it("should have valid structure", () => {
      expect(DEFAULT_CONFIG.theme).toBe("dark");
      expect(DEFAULT_CONFIG.display.lines).toHaveLength(1);
      expect(DEFAULT_CONFIG.colors.dark).toBeDefined();
      expect(DEFAULT_CONFIG.budget?.today).toBeDefined();
    });
  });

  describe("loadConfig", () => {
    it("should return defaults when no config exists", () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(loadConfig()).toEqual(DEFAULT_CONFIG);
    });

    it("should merge project config over defaults", () => {
      const projectConfig = { theme: "dark" };
      mockFs.existsSync.mockImplementation(
        (path) => path === "/project/.claude-powerline.json"
      );
      mockFs.readFileSync.mockReturnValue(JSON.stringify(projectConfig));

      const config = loadConfig();
      expect(config.theme).toBe("dark");
      expect(config.display).toEqual(DEFAULT_CONFIG.display);
    });

    it("should handle invalid JSON gracefully", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      const config = loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("CLI argument parsing", () => {
    it("should parse theme from CLI", () => {
      mockFs.existsSync.mockReturnValue(false);
      const config = loadConfigFromCLI(["node", "script", "--theme=dark"]);
      expect(config.theme).toBe("dark");
    });

    it("should parse budget flags", () => {
      mockFs.existsSync.mockReturnValue(false);

      const dailyConfig = loadConfigFromCLI([
        "node",
        "script",
        "--daily-budget=25.50",
      ]);
      expect(dailyConfig.budget?.today?.amount).toBe(25.5);

      const sessionConfig = loadConfigFromCLI([
        "node",
        "script",
        "--session-budget=15.75",
      ]);
      expect(sessionConfig.budget?.session?.amount).toBe(15.75);

      const bothConfig = loadConfigFromCLI([
        "node",
        "script",
        "--session-budget=10",
        "--daily-budget=50",
      ]);
      expect(bothConfig.budget?.session?.amount).toBe(10);
      expect(bothConfig.budget?.today?.amount).toBe(50);
    });

    it("should ignore invalid budget values", () => {
      mockFs.existsSync.mockReturnValue(false);

      const config = loadConfigFromCLI([
        "node",
        "script",
        "--daily-budget=invalid",
      ]);
      expect(config.budget?.today?.amount).toBe(50);

      const sessionConfig = loadConfigFromCLI([
        "node",
        "script",
        "--session-budget=invalid",
      ]);
      expect(sessionConfig.budget?.session?.amount).toBeUndefined();
    });
  });

  describe("getDefaultConfigJSON", () => {
    it("should return valid JSON string", () => {
      const json = getDefaultConfigJSON();
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(DEFAULT_CONFIG);
    });
  });
});
