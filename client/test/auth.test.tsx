import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as authApi from "../src/api/authApi";
import { ApiError } from "../src/api/httpClient";
import { ALICE, renderAppAt } from "./renderWithAuth";

vi.mock("../src/api/authApi");
const mockedAuthApi = vi.mocked(authApi);

async function fillInLoginForm(username: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Username"), username);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedAuthApi.fetchCurrentUser.mockResolvedValue(null);
});

describe("LoginPage", () => {
  it("logs in and goes to the home page", async () => {
    mockedAuthApi.logIn.mockResolvedValue(ALICE);
    renderAppAt("/login");

    await fillInLoginForm("alice", "secret");

    expect(mockedAuthApi.logIn).toHaveBeenCalledWith({
      username: "alice",
      password: "secret",
    });
    expect(await screen.findByText("You're logged in")).toBeInTheDocument();
  });

  it("shows the server's error message on a 401", async () => {
    mockedAuthApi.logIn.mockRejectedValue(
      new ApiError(401, "Invalid username or password"),
    );
    renderAppAt("/login");

    await fillInLoginForm("alice", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid username or password",
    );
  });

  it("disables the submit button while logging in", async () => {
    mockedAuthApi.logIn.mockReturnValue(new Promise(() => {}));
    renderAppAt("/login");

    await fillInLoginForm("alice", "secret");

    expect(screen.getByRole("button", { name: "Logging in…" })).toBeDisabled();
  });
});

describe("RequireAuth", () => {
  it("redirects to the login page when nobody is logged in", async () => {
    renderAppAt("/");

    expect(
      await screen.findByRole("button", { name: "Log in" }),
    ).toBeInTheDocument();
  });

  it("shows the protected page when logged in", async () => {
    mockedAuthApi.fetchCurrentUser.mockResolvedValue(ALICE);
    renderAppAt("/");

    expect(await screen.findByText("You're logged in")).toBeInTheDocument();
  });
});

describe("AppHeader", () => {
  it("shows the user's name and logs out back to the login page", async () => {
    mockedAuthApi.fetchCurrentUser.mockResolvedValue(ALICE);
    mockedAuthApi.logOut.mockResolvedValue(undefined);
    renderAppAt("/");

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(mockedAuthApi.logOut).toHaveBeenCalledOnce());
    expect(
      await screen.findByRole("button", { name: "Log in" }),
    ).toBeInTheDocument();
  });
});
