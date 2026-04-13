import { Component, Inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResourcesListComponent } from "./resources-list/resources-list.component";
import { ButtonModule } from 'primeng/button';
import { PrimeIcons } from 'primeng/api';

import
{
	MsalService,
	MsalModule,
	MsalBroadcastService,
	MSAL_GUARD_CONFIG,
	MsalGuardConfiguration,
} from '@azure/msal-angular';
import
{
	AuthenticationResult,
	InteractionStatus,
	PopupRequest,
	RedirectRequest,
	EventMessage,
	EventType,
	InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { firstValueFrom, Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { HttpClient } from '@angular/common/http';
import { xrmGlobal } from './global';

import { RouterOutlet } from '@angular/router';

import * as $ from 'jquery';

@Component({
	selector: 'app-root',
	standalone: true,
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	imports: [ResourcesListComponent, MsalModule, RouterOutlet, FormsModule, ButtonModule]
})
export class AppComponent
{
	PrimeIcons = PrimeIcons;

	title = 'dbm-app';
	isFullApp: boolean;

	public get isReady(): boolean 
	{
		return !!globalThis.Xrm || !!xrmGlobal.accessToken;
	}
	
	public set baseUrl(t : string) {
		xrmGlobal.baseUrl = t;
	}

	isIframe = false;
	loginDisplay = false;
	private readonly _destroying$ = new Subject<void>();

	constructor(
		@Inject(MSAL_GUARD_CONFIG) private msalGuardConfig: MsalGuardConfiguration,
		private authService: MsalService,
		private msalBroadcastService: MsalBroadcastService,
		private http: HttpClient
	) { }

	async ngOnInit()
	{
		(globalThis as any).$ = (parent as any).$ ?? $;
		(globalThis as any).Xrm = (parent as any).Xrm;
		(globalThis as any).xrmGlobal = xrmGlobal;

		const params =
			new Proxy(new URLSearchParams(window.location.search), {
				get: (searchParams, prop: string) => searchParams.get(prop),
			});

		const dbmType = JSON.parse((<any>params).data)?.dbmType as string ?? "Object";
		this.isFullApp = dbmType !== 'Script';

		if (!this.isReady)
		{
			await firstValueFrom(this.authService.initialize());
			const redirectResult = await firstValueFrom(this.authService.handleRedirectObservable());
			if (redirectResult?.account)
			{
				this.authService.instance.setActiveAccount(redirectResult.account);
			}

			this.isIframe = window !== window.parent && !window.opener; // Remove this line to use Angular Universal

			this.setLoginDisplay();

			this.msalBroadcastService.msalSubject$
				.pipe(
					filter(
						(msg: EventMessage) =>
							msg.eventType === EventType.LOGIN_SUCCESS ||
							msg.eventType === EventType.ACQUIRE_TOKEN_SUCCESS
					),
					takeUntil(this._destroying$)
				)
				.subscribe((result: EventMessage) =>
				{
					const payload = result.payload as AuthenticationResult | null;
					if (payload?.account)
					{
						this.authService.instance.setActiveAccount(payload.account);
					}

					this.setLoginDisplay();
				});

			this.msalBroadcastService.inProgress$
				.pipe(
					filter(
						(status: InteractionStatus) => status === InteractionStatus.None
					),
					takeUntil(this._destroying$)
				)
				.subscribe(() =>
				{
					this.setLoginDisplay();
					this.checkAndSetActiveAccount();
				});
			
			if (!!xrmGlobal.baseUrl)
			{
				this.loginPopup();
			}
		}
	}

	setLoginDisplay()
	{
		this.loginDisplay = this.authService.instance.getAllAccounts().length > 0;
	}

	checkAndSetActiveAccount()
	{
		/**
		 * If no active account set but there are accounts signed in, sets first account to active account
		 * To use active account set here, subscribe to inProgress$ first in your component
		 * Note: Basic usage demonstrated. Your app may require more complicated account selection logic
		 */
		let activeAccount = this.authService.instance.getActiveAccount();

		if (
			!activeAccount &&
			this.authService.instance.getAllAccounts().length > 0
		)
		{
			let accounts = this.authService.instance.getAllAccounts();
			this.authService.instance.setActiveAccount(accounts[0]);
		}
	}

	loginRedirect()
	{
		if (this.msalGuardConfig.authRequest)
		{
			this.authService.loginRedirect({
				...this.msalGuardConfig.authRequest,
			} as RedirectRequest);
		} else
		{
			this.authService.loginRedirect();
		}
	}

	loginPopup()
	{
		if (this.msalGuardConfig.authRequest)
		{
			this.authService
				.loginPopup({ ...this.msalGuardConfig.authRequest } as PopupRequest)
				.subscribe((response: AuthenticationResult) =>
				{
					this.authService.instance.setActiveAccount(response.account);

					const request =
					{
						scopes: [`${xrmGlobal.baseUrl}/.default`],
						account: this.authService.instance.getAccount({ username: response.account.username }) ?? response.account
					};

					this.authService.instance.acquireTokenSilent(request)
						.then(tokenResponse =>
						{
							console.log(tokenResponse);
							console.log(xrmGlobal.accessToken = tokenResponse.accessToken);
							(globalThis as any).Xrm = xrmGlobal.Xrm;
						})
						.catch(error =>
						{
							console.warn("Silent token acquisition fails. Acquiring token using popup");

							if (error instanceof InteractionRequiredAuthError)
							{
								// fallback to interaction when silent call fails
								return this.authService.instance.acquireTokenPopup(request)
									.then(tokenResponse =>
									{
										console.log(xrmGlobal.accessToken = tokenResponse.accessToken);
										(globalThis as any).Xrm = xrmGlobal.Xrm;
										return tokenResponse;
									})
									.catch(error =>
									{
										console.error(error);
									});
							} else
							{
								console.warn(error);
								return null;
							}
						});
				});
		} else
		{
			this.authService
				.loginPopup()
				.subscribe((response: AuthenticationResult) =>
				{
					this.authService.instance.setActiveAccount(response.account);
					console.log(globalThis.accessToken = response.accessToken);
				});
		}
	}

	logout(popup?: boolean)
	{
		if (popup)
		{
			this.authService.logoutPopup({
				mainWindowRedirectUri: '/',
			});
		} else
		{
			this.authService.logoutRedirect();
		}
	}

	ngOnDestroy(): void
	{
		this._destroying$.next(undefined);
		this._destroying$.complete();
	}
}
