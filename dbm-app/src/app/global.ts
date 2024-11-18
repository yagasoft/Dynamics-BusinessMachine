export const xrmGlobal = {
	baseUrl: 'https://ldv-rd-min.crm4.dynamics.com',
	accessToken: '',
	Xrm:
	{
		Utility:
		{
			getGlobalContext: () =>
			{
				return {
					getClientUrl: () => xrmGlobal.baseUrl
				}
			}
		}
	}
};
