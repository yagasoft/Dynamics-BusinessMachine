import { AfterViewInit, Component, EventEmitter, Input, Output, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PrimeIcons } from 'primeng/api';
import * as CKSource from '../../assets/ckeditor';
import { style_html } from '../../assets/html-beautify';
import { Compartment, Extension, EditorState } from '@codemirror/state';
import { Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, defaultHighlightStyle, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { lintKeymap } from '@codemirror/lint'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { crosshairCursor, drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers, rectangularSelection } from '@codemirror/view'

@Component({
	selector: 'ys-editor',
	standalone: true,
	imports: [FormsModule, InputTextModule, CommonModule],
	templateUrl: './editor.component.html',
	styleUrl: './editor.component.scss'
})
export class YsEditorComponent implements AfterViewInit
{
	PrimeIcons = PrimeIcons;

	get entryId(): string
	{
		return this._entryId;
	}

	@Input() set entryId(value: string)
	{
		if (this._isInitialised)
		{
			this.entryIdChange.emit(value);
		}

		this._entryId = value;
	}

	@Output() entryIdChange = new EventEmitter<string>();

	private _entryId!: string;

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

		if (this._isInitialised)
		{
			this.codeEditor
				.dispatch({
					changes: { from: 0, to: this.codeEditor.state.doc.length, insert: value }
				});
		}
	}

	@Output() codeChange = new EventEmitter<string>();

	get isRichEditor(): boolean
	{
		return this._isRichEditorShown;
	}

	@Input() set isRichEditor(value: boolean)
	{
		if (this._isInitialised)
		{
			this.isRichEditorChange.emit(value);
		}

		this._isRichEditorShown = value;
	}

	@Output() isRichEditorChange = new EventEmitter<boolean>();

	private _isRichEditorShown = false;

	private _code!: string;
	private _isInitialised = false;

	id = Math.random().toString();

	codeEditor!: EditorView;
	readOnly = new Compartment;

	watchdog: any;
	richEditor: any;
	isConfirm: boolean = false;

	@ViewChild('codeEditorElement') codeEditorElement: any;
	@ViewChild('richEditorElement') richEditorElement!: ElementRef;

	constructor(@Inject(DOCUMENT) private document: Document) { }

	ngAfterViewInit()
	{
		const codeEditorElementNative = this.codeEditorElement.nativeElement;

		const myExt: Extension = [
			lineNumbers(),
			highlightActiveLineGutter(),
			highlightSpecialChars(),
			history(),
			foldGutter(),
			drawSelection(),
			dropCursor(),
			EditorState.allowMultipleSelections.of(true),
			indentOnInput(),
			syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
			bracketMatching(),
			closeBrackets(),
			autocompletion(),
			rectangularSelection(),
			crosshairCursor(),
			highlightActiveLine(),
			highlightSelectionMatches(),
			keymap.of([
				...closeBracketsKeymap,
				...defaultKeymap,
				...searchKeymap,
				...historyKeymap,
				...foldKeymap,
				...completionKeymap,
				...lintKeymap,
			]),
			this.readOnly.of(EditorState.readOnly.of(false)),
			EditorView.updateListener.of((e) =>
			{
				if (e.docChanged)
				{
					setTimeout(() =>
					{
						this.codeUpdated(e.state.doc.toString());
					}, 0);
				}
			}),
			javascript()];

		this.codeEditor =
			new EditorView({
				parent: codeEditorElementNative,
				state:
					EditorState.create({
						doc: this._code,
						extensions: myExt,
					}),
			});

		const ckSource = <any>CKSource;

		this.watchdog = new ckSource.EditorWatchdog(null);

		this.watchdog
			.setCreator((element: any, config: any) =>
			{
				return ckSource.Editor
					.create(element, config)
					.then((editor: any) =>
					{
						// editor.model.document
						// 	.on('change:data', (evt: any, data: any) =>
						// 	{
						// 		if (this.isRichEditor)
						// 		{
						// 			this.code = style_html(editor.getData());
						// 		}
						// 	});

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

	toggleRichEditor()
	{
		if (this.isRichEditor)
		{
			if (!this.isConfirm)
			{
				this.isConfirm = true;
			}
		}
		else
		{
			this.codeEditor.dispatch({
				effects: this.readOnly.reconfigure(EditorState.readOnly.of(true))
			});

			this.richEditor.setData(this.codeEditor.state
				.sliceDoc(this.codeEditor.state.selection.main.from, this.codeEditor.state.selection.main.to));

			this.isRichEditor = true;
		}
	}

	updateFromRichEditor(isUpdate: boolean)
	{
		this.isRichEditor = false;

		if (isUpdate)
		{
			this.codeEditor
				.dispatch({
					changes: { from: this.codeEditor.state.selection.main.from, to: this.codeEditor.state.selection.main.to, insert: style_html(this.richEditor.getData()) }
				});
		}

		this.codeEditor.dispatch({
			effects: this.readOnly.reconfigure(EditorState.readOnly.of(false))
		});

		this.isConfirm = false;
	}

	codeUpdated(value: string)
	{
		if (this._code === value)
		{
			return;
		}

		if (this._isInitialised)
		{
			this.codeChange.emit(value);
		}

		this._code = value;
	}
}
