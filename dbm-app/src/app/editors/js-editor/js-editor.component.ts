import { AfterViewInit, Component, EventEmitter, Input, Output, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PrimeIcons } from 'primeng/api';
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
import { HtmlEditorComponent } from '../html-editor/html-editor.component'

@Component({
	selector: 'ys-js-editor',
	standalone: true,
	imports: [FormsModule, InputTextModule, CommonModule, HtmlEditorComponent],
	templateUrl: './js-editor.component.html',
	styleUrl: './js-editor.component.scss'
})
export class JsEditorComponent implements AfterViewInit
{
	PrimeIcons = PrimeIcons;

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

		if (!this.codeEditor)
		{
			setTimeout(() => {
				this.code = this.code;
			}, 100);
			
			return;
		}

		this.codeEditor
			.dispatch({
				changes: { from: 0, to: this.codeEditor.state.doc.length, insert: value }
			});
	}

	@Output() codeChange = new EventEmitter<string>();

	html: string;
	isRichEditor: boolean;

	private latestChange = 0;

	private _code!: string;
	private _isInitialised = false;

	id = Math.random().toString();

	codeEditor!: EditorView;
	readOnly = new Compartment;

	isConfirm: boolean = false;

	@ViewChild('codeEditorElement') codeEditorElement: any;

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
			EditorView.updateListener
				.of((e) =>
				{
					if (e.docChanged)
					{
						const change = this.latestChange = Date.now();

						setTimeout(() =>
						{
							if (change == this.latestChange)
							{
								this.codeUpdated(e.state.doc.toString());
							}
						}, 50);
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

			this.html = this.codeEditor.state
				.sliceDoc(this.codeEditor.state.selection.main.from, this.codeEditor.state.selection.main.to);

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
					changes: { from: this.codeEditor.state.selection.main.from, to: this.codeEditor.state.selection.main.to, insert: this.html }
				});
		}

		this.codeEditor
			.dispatch({
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

		this._code = value;

		if (this._isInitialised)
		{
			this.codeChange.emit(value);
		}
	}
}
