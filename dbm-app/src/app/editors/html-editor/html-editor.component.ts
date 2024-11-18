import { Component, ElementRef, EventEmitter, Inject, Input, Output, ViewChild } from '@angular/core';
import * as CKSource from '../../../assets/ckeditor';
import { style_html } from '../../../assets/html-beautify';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'ys-html-editor',
  standalone: true,
  imports: [],
  templateUrl: './html-editor.component.html',
  styleUrl: './html-editor.component.scss'
})
export class HtmlEditorComponent {
	get code(): string
	{
		return this._code;
	}

	@Input() set code(value: string)
	{
		if (this._code === value)
		{
			return;
		}

		this._code = value;

		this.richEditor.setData(value);
	}

	@Output() codeChange = new EventEmitter<string>();
	
	private _code!: string;

	watchdog: any;
	richEditor: any;

	private latestChange = 0;

	private _isInitialised = false;

	@ViewChild('richEditorElement') richEditorElement!: ElementRef;
	
	constructor(@Inject(DOCUMENT) private document: Document) { }

	ngAfterViewInit()
	{
		const ckSource = <any>CKSource;

		this.watchdog = new ckSource.EditorWatchdog(null);

		this.watchdog
			.setCreator((element: any, config: any) =>
			{
				return ckSource.Editor
					.create(element, config)
					.then((editor: any) =>
					{
						editor.model.document
							.on('change:data', (evt: any, data: any) =>
							{
								const change = this.latestChange = Date.now();
								
								setTimeout(() =>
								{
									if (change == this.latestChange)
									{
										this.codeUpdated(style_html(editor.getData()));
									}
								}, 100);
							});
						
						editor.editing.view.change((writer) =>
						{
							writer.setStyle(
								"overflow",
								"auto",
								editor.editing.view.document.getRoot()
							);
						});

						return this.richEditor = editor;
					});
			});

		this.watchdog
			.setDestructor((editor: any) =>
			{
				return editor.destroy();
			});

		this.watchdog.on('error', handleRichEditorError);

		this.watchdog
			.create(this.richEditorElement.nativeElement as HTMLElement, {
				// Editor configuration.
			})
			.catch(handleRichEditorError);

		function handleRichEditorError(error: any)
		{
			const issueUrl = 'https://github.com/ckeditor/ckeditor5/issues';

			const message = [
				'Oops, something went wrong!',
				`Please, report the following error on ${issueUrl} with the build id "cin1cpg3ytig-d38iyjanp32b" and the error stack trace:`
			].join('\n');

			console.error(message);
			console.error(error);
		}

		this._isInitialised = true;
	}

	codeUpdated(value: string)
	{
		if (this._code === value)
		{
			return;
		}

		this._code = value;

		if (this._isInitialised)
		{
			this.codeChange.emit(value);
		}
	}
}
