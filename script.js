/**
 * MIT License
 *
 * Copyright (c) 2022 cho45<cho45@lowreal.net>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Based on
 * https://github.com/Santi-hr/UNI-T-Thermal-Utilities
 *
 * MIT License
 *
 * Copyright (c) 2020 Santi-hr
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
class UNITThermalImage {
	constructor(arrayBuffer) {
		this.arrayBuffer = arrayBuffer;
		this.view = new DataView(this.arrayBuffer);
		this.bmp_header = new Map();
		this._parse_bmp_header();

		let offset = this._extract_grayscale_img();
		offset = this._extract_palette(offset);
		offset = this._extract_temp_data(offset);

		this._set_fix_temp_matrix();
		this._set_fix_grayscale_image();
	}

	get width() {
		return this.bmp_header.get('img_width_px');
	}

	get height() {
		return this.bmp_header.get('img_height_px');
	}

	getValueOf(x, y) {
		const n = y * this.width + x;
		return this.raw_img[n];
	}

	getTemperatureOf(x, y) {
		const v = this.getValueOf(x, y);
		const min = this.temp_min;
		const max = this.temp_max;
		return min + (max - min) * (v / 254);
	}

	getFixedTemperatureOf(x, y) {
		const n = y * this.width + x;
		return this.fix_temp[n];
	}

	_parse_bmp_header() {
		this.bmp_header.set('file_size', this.view.getInt32(2, true));
		this.bmp_header.set('data_start_byte', this.view.getInt32(10, true));
		this.bmp_header.set('bmp_header_size', this.view.getInt32(14, true));
		this.bmp_header.set('img_width_px', this.view.getInt32(18, true));
		this.bmp_header.set('img_height_px', this.view.getInt32(22, true));
		this.bmp_header.set('plane_num', this.view.getInt16(26, true));
		this.bmp_header.set('bits_per_px', this.view.getInt16(28, true));
		this.bmp_header.set('compression', this.view.getInt32(30, true));
		this.bmp_header.set('img_size', this.view.getInt32(34, true));
		this.bmp_header.set('horizontal_res', this.view.getInt32(38, true));
		this.bmp_header.set('vertical_res', this.view.getInt32(42, true));
		this.bmp_header.set('color_table_size', this.view.getInt32(46, true));
		this.bmp_header.set('important_colors', this.view.getInt32(50, true));

		console.log(
			'bitmap',
			this.bmp_header.get('data_start_byte'), 
			this.bmp_header.get('img_width_px') * this.bmp_header.get('img_height_px') * 3
		);
		// BGR bitmap
		this.bitmap = new Uint8Array(
			this.arrayBuffer,
			this.bmp_header.get('data_start_byte'), 
			this.bmp_header.get('img_width_px') * this.bmp_header.get('img_height_px') * 3
		);
	}

	_extract_grayscale_img() {
		const raw_image_size = this.bmp_header.get('img_width_px') * this.bmp_header.get('img_height_px');
		const byte_image_end = this.bmp_header.get('file_size') + raw_image_size
		this.raw_img = new Uint8Array(this.arrayBuffer, this.bmp_header.get('file_size'), raw_image_size);
		return byte_image_end;
	}

	_extract_palette(byte_index_input) {
		const palette_size = 512;
		const bytes_per_color = 2
		this.palette_rgb = new Uint8Array(Math.round(palette_size / bytes_per_color) * 3);
		for (let n = 0, i = byte_index_input, len = byte_index_input + palette_size; i < len; i += 2, n++) {
			const color_raw = this.view.getUint16(i, true);
			const color_r_raw = (color_raw & 0xF800) >> 11;
			const color_g_raw = (color_raw & 0x7E0) >> 5;
			const color_b_raw = (color_raw & 0x1F);
			const color_r = Math.round(color_r_raw * 0xFF / 0x1F);
			const color_g = Math.round(color_g_raw * 0xFF / 0x3F);
			const color_b = Math.round(color_b_raw * 0xFF / 0x1F);
			this.palette_rgb[n*3+0] = color_r;
			this.palette_rgb[n*3+1] = color_g;
			this.palette_rgb[n*3+2] = color_b;
		}
		return byte_index_input + palette_size;
	}

	_extract_temp_data(byte_index_input) {
		this.temp_units = (this.view.getUint8(byte_index_input) === 0) ? 'C' : 'F';

		this.temp_max = this.view.getInt16(byte_index_input + 1, true) / 10;
		this.temp_min = this.view.getInt16(byte_index_input + 3, true) / 10;
		this.temp_center = this.view.getInt16(byte_index_input + 7, true) / 10;
		this.emissivity = this.view.getUint8(byte_index_input + 9) / 100;
		this.temp_min_pos_w = this.view.getInt16(byte_index_input + 14, true);
		this.temp_min_pos_h = this.view.getInt16(byte_index_input + 16, true);
		this.temp_max_pos_w = this.view.getInt16(byte_index_input + 18, true);
		this.temp_max_pos_h = this.view.getInt16(byte_index_input + 20, true);
		this.temp_center_pos_w = this.view.getInt16(byte_index_input + 22, true);
		this.temp_center_pos_h = this.view.getInt16(byte_index_input + 24, true);

		return byte_index_input + 26;
	}

	_set_fix_temp_matrix() {
		const fix_temp = new Float32Array(this.raw_img.length);
		const center_gray = this.getValueOf(this.temp_center_pos_w, this.temp_center_pos_h);
		for (let i = 0, len = this.raw_img.length; i < len; i++) {
			const v = this.raw_img[i];
			if (v >= center_gray && v !== 254) {
				fix_temp[i] = this.temp_center + (this.temp_max - this.temp_center) * ((v - center_gray) / (254.0 - center_gray));
			} else
			if (v < center_gray && v !== 0) {
				fix_temp[i] = this.temp_min + (this.temp_center - this.temp_min) * (v / center_gray);
			} else
			if (v === 0) {
				fix_temp[i] = this.temp_min;
			} else
			if (v === 254) {
				fix_temp[i] = this.temp_max;
			}
		}
		this.fix_temp = fix_temp;
	}

	_set_fix_grayscale_image() {
		const fix_img = new Uint8Array(this.raw_img.length);
		for (let i = 0, len = this.raw_img.length; i < len; i++) {
			fix_img[i] = Math.round((this.fix_temp[i] - this.temp_min)/(this.temp_max - this.temp_min) * 254)
		}
		this.fix_img = fix_img;
	}
}

new Vue({
	el: '#app',
	vuetify: new Vuetify(),
	data: {
		temp_min: 0,
		temp_max: 0,
		emissivity: 0,

		options: {
			showMaxTarget: true,
			showMinTarget: true,
			showPalette: true,
			useTemperatureFix: true,
			palette: null
		},

		palettes : [
			{ name: '-', image: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' },
			{ name: 'Iron', image : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAABCAYAAAAxWXB3AAAAAXNSR0IArs4c6QAAAOpJREFUOE+FU8sKxDAIdCGB5N7L/v9HtofCFh+j0xDYQJuo4zjm8ZHj+5N7iNwiNot+U3KkLzCGUIyOuVlp1OP+dy54iJl4EHck2CsP1d41obHwXBc5F1VXn9qVOWC30sAaDdn0d8qwOQbh3eO8jrkixyOV55jJPOY5HW+cpK+TnTnEvdVF+W2pF7b34zpTW/pCi/UdXBEzbcC9Zu6X86NMr3roM89h2VPe39p7nEHtffWwieWZUexfnV1O+uKGGUess6dJe0I3ty232HLjZnEs18CP4MMtVBvvEhzA0HtNbXpK6zuGjbdd2h4RliDuz19cAAAAAABJRU5ErkJggg==' },
			{ name: 'Rainbow', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAABCAYAAAAxWXB3AAAAAXNSR0IArs4c6QAAATJJREFUOE9dU11qxjAM06AFB/awHWH3P9weNqjhK2xI/qnbQhtHkWXHdt9gX384DcAnAANOABsejwEb34S5cs/nfSWee57tyW2f4kzZ1CQk3eGPFcSK8bRv2aWfsIqb/uVXd5r5t6YPP8A2gIi+zSdyRNSdtouHLWxF3nhOH8cSfsg2ci10gW+dCZOf48OARd+TmsSTa64qaJ+YbnVGHrbFHRnXjPZRFazqwXYAr9V4V0o4mncrJ2vFtzqStvayc0a0OmJ2xjP4QrnnVeda+NDzH2plDOVgwO/l5x5nXvm13grtV3D9lo9lzjFj3nM2es5a1JxWv21lf3ldg7GB6vf1quvNH3MnvdDULOXsxbxMnWH3FJGT/0rPXvCMvir1VW/eR3jFVMEf/2O1JvVyWrPBhn83NFjJ+7PLegAAAABJRU5ErkJggg==' },
			{ name: 'White Hot', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAABCAYAAAAxWXB3AAAAAXNSR0IArs4c6QAAAHFJREFUOE+9U9EKwCAIvIGB/v8HL5TRSlpiwXr0PO847QJwY/ZoLDLxWEjiIEAg7wzHV5zRaUxwJbee4kw//Q3/4CvLfCxwm7HAzUc2DyUlMxPq8trgpz26TH/Xd/lE+lt7SO4gyjDyyOXs3xzrB3daAbnHA+pmCRcvAAAAAElFTkSuQmCC' },
			{ name: 'Red Hot', image : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAABCAYAAAAxWXB3AAAAAXNSR0IArs4c6QAAANJJREFUOE99Ue0KwkAMq3BC75UE//j+77MDBaXfubIpjDVpmsbu9no+voS/wYUGUSLgeYjEO1oTJedYuDmmNV1vmsLCq4t7V9/mZuy52wyLOj0UJWbcNZjUIbPYXOkrO+4PvXGYfc8ZOtvR7oCc1JI9rtU8626uwNtt+WFPesFHg7natX1VuEXj/8J10kXugH7w2I86dF3TMeqwd84vutLvexe1PR+JvYj0Tf4+dowaqeMR/Vuwz2MPar7g1UfiYF/9/MFe13UMXowemLXnyP9r+37+TF0Ai/mtFAAAAABJRU5ErkJggg==' },
			{ name: 'Lava', image : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAABCAYAAAAxWXB3AAAAAXNSR0IArs4c6QAAAPxJREFUOE99U+0KwyAMvIEF+699/wdVqLDt8qHRdhOs8e6SaBpfAN7gSFkndlmz75PtYXzQYMvYRccAqvOZBQMqcYnPT7FVoYEPuzzh3d/jMO7inxzhHaizfQraGOfmH85Ec/N9z3Q/+1O8HqYCDcicF7Cb3bEG4YmjFeRqWsPpp9yKh/No1aXKPvIVbAcZB4V/0MbQSA6LMfHMO5VEfQRr+pcmvikfzyO89YGv3hfi7xz9gs3aR9+uixqx6xI/9Bf5nnv0wnyeX7j5ur9f1Fq5X9xzTLmWO8f7/9OttVrqIcWV93Va5Y9hy5s8gXQoxzcL8o5zJcc3GvCv9gPGVDj+lj/qagAAAABJRU5ErkJggg==' },
			{ name: 'Rainbow HC', image : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAABCAYAAAAxWXB3AAAAAXNSR0IArs4c6QAAATRJREFUOE9tUwFqwzAQ0yABGzzI/v/IBhKwYYW1Oukatyzg3p2kU+4y7wvAH/wUlLesohpJhlEacVc9ZxVAgX75pC573jG5zW/47Mn6vzhyeACZD2fdHPHECM26WXNxQqm7eDlkbyoSIztzWRO7oYtbfLaqT/NTgK0ADYrkmfMEZx056ps1387vA+A5boqvA+WjA2M3Tqwr5zSD+g6cu77Sr3vCg332I5fYna30AwpHWoDa8q+smnj1nqy31ZhX4I5ch7HaY2u8Ae6nBz3Juzd8Yw5gHMA4NQbX6LtGjYf44fWYe9XO/JQH+9Kjkz/lq1uoueJdS4kZ4s4tvvNZU0ndB68+3dKX1zp5kCvs5eLXKc3/K/FdjNeKSg3r6MvIOyG8MOp1+ol+zYbVvUF5F3KuIz51D8Eufu5j06W3AAAAAElFTkSuQmCC' },
		]
	},

	watch: {
		options: {
			deep: true,
			handler: async function (old, value) {
				await this.loadPalette();
				this.drawPalettedBitmap();
			}
		}
	},

	created: function () {
		console.log('created');
	},

	mounted: function () {
		console.log('mounted');
		this.loadTestImage();

		const images = this.$refs.images;
		const tooltip = this.$refs.tooltip;
		images.addEventListener('mousemove', (e) => {
			if (e.target.nodeName !== 'CANVAS') {
				tooltip.style.display = "none";
				return;
			}
			const x = e.offsetX;
			const y = e.offsetY;
			const v = this.image.getFixedTemperatureOf(x, y).toFixed(1);

			tooltip.style.display = "block";
			tooltip.style.top = e.pageY + 20 + 'px';
			tooltip.style.left = e.pageX + 20 + 'px';
			tooltip.textContent = v;
		}, false);
		images.addEventListener('mouseleave', (e) => {
			tooltip.style.display = "none";
		}, false);
	},

	methods: {
		loadButton: function () {
			this.$refs.input.$el.querySelector('input').click();
		},

		changeImage: async function (file) {
			console.log(file);
			const bitmap = await this.readFile(file);
			this.loadImage(bitmap);
		},

		readFile: async function (file) {
			return new Promise( (resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					resolve(reader.result);
				};
				reader.onerror = reject;
				reader.readAsArrayBuffer(file);
			});
		},

		loadTestImage: async function () {
			const res = await fetch('./IMG_0032.bmp');
			const bitmap = await res.arrayBuffer();
			this.loadImage(bitmap);
		},

		loadImage: function (bitmap) {
			this.image = new UNITThermalImage(bitmap);
			console.log(this.image);
			this.drawOriginalBitmap();
			this.drawRawBitmap();
			this.drawFixedBitmap();
			this.drawPalette();
			this.drawPalettedBitmap();
			this.temp_min = this.image.temp_min;
			this.temp_max = this.image.temp_max;
			this.emissivity = this.image.emissivity;
		},

		loadPalette: async function () {
			const palette = this.options.palette;
			if (palette.name === '-') {
				this.palette_rgb = null;
				this.drawPalette();
				return;
			}

			return new Promise( (resolve, reject) => {
				const img = new Image();
				img.onload = () => {
					const canvas = this.$refs.palette;
					canvas.width = 256;
					canvas.height = 1;
					const ctx = canvas.getContext('2d');
					ctx.drawImage(img, 0, 0, 256, 1);
					const data = ctx.getImageData(0, 0, 256, 1).data;
					for (let i = 0; i < 256; i++) {
						const r = data[(i*4)+0];
						const g = data[(i*4)+1];
						const b = data[(i*4)+2];
						data[(i*3)+0] = r;
						data[(i*3)+1] = g;
						data[(i*3)+2] = b;
					}
					this.palette_rgb = data;
					this.drawPalette();
					resolve();
				};
				img.onerror = reject;
				img.src = palette.image;
			});
		},

		drawOriginalBitmap: function () {
			const image = this.image;
			const canvas = this.$refs.loaded;
			canvas.width = image.width;
			canvas.height = image.height;
			const ctx = canvas.getContext('2d');
			const imagedata = ctx.createImageData(image.width, image.height);
			for (let y = 0, h = image.height; y < h; y++) {
				for (let x = 0, w = image.width; x < w; x++) {
					// bitmap stores pixels from left bottom to right top
					const s = ((h - y) * w + x) * 3;
					const b = image.bitmap[s+0];
					const g = image.bitmap[s+1];
					const r = image.bitmap[s+2];

					const d = (y * w + x) * 4;
					imagedata.data[d+0] = r;
					imagedata.data[d+1] = g;
					imagedata.data[d+2] = b;
					imagedata.data[d+3] = 255; // alpha
				}
			}
			ctx.putImageData(imagedata, 0, 0);
		},

		drawRawBitmap: function () {
			const image = this.image;
			const canvas = this.$refs.raw;
			canvas.width = image.width;
			canvas.height = image.height;
			const ctx = canvas.getContext('2d');
			const imagedata = ctx.createImageData(image.width, image.height);
			for (let i = 0, len = image.width * image.height; i < len; i++) {
				const l = image.raw_img[i];
				imagedata.data[i*4+0] = l;
				imagedata.data[i*4+1] = l;
				imagedata.data[i*4+2] = l;
				imagedata.data[i*4+3] = 255;
			}
			ctx.putImageData(imagedata, 0, 0);
		},

		drawFixedBitmap: function () {
			const image = this.image;
			const canvas = this.$refs.fixed;
			canvas.width = image.width;
			canvas.height = image.height;
			const ctx = canvas.getContext('2d');
			const imagedata = ctx.createImageData(image.width, image.height);
			for (let i = 0, len = image.width * image.height; i < len; i++) {
				const l = image.fix_img[i];
				imagedata.data[i*4+0] = l;
				imagedata.data[i*4+1] = l;
				imagedata.data[i*4+2] = l;
				imagedata.data[i*4+3] = 255;
			}
			ctx.putImageData(imagedata, 0, 0);
		},

		drawPalettedBitmap: function () {
			const image = this.image;
			const canvas = this.$refs.paletted;
			canvas.width = image.width;
			canvas.height = image.height;
			const ctx = canvas.getContext('2d');
			const imagedata = ctx.createImageData(image.width, image.height);
			const palette_rgb = this.palette_rgb || image.palette_rgb;
			for (let i = 0, len = image.width * image.height; i < len; i++) {
				const l = image.fix_img[i];

				const r = palette_rgb[l*3+0];
				const g = palette_rgb[l*3+1];
				const b = palette_rgb[l*3+2];

				imagedata.data[i*4+0] = r;
				imagedata.data[i*4+1] = g;
				imagedata.data[i*4+2] = b;
				imagedata.data[i*4+3] = 255;
			}
			ctx.putImageData(imagedata, 0, 0);
			ctx.drawImage(canvas, 0, 0);

			function drawTarget(x, y, color) {
				ctx.save();
				ctx.strokeStyle = color;
				ctx.lineJoin = 'round';
				ctx.lineCap = 'round';
				ctx.lineWidth = 3;

				ctx.beginPath();
				// cross vertical
				ctx.moveTo(x, y - 4);
				ctx.lineTo(x, y + 4);
				// cross horizontal
				ctx.moveTo(x - 4, y);
				ctx.lineTo(x + 4, y);

				// left top
				ctx.moveTo(x - 10, y - 5);
				ctx.lineTo(x - 10, y - 10);
				ctx.lineTo(x -  5, y - 10);
				// right top
				ctx.moveTo(x +  5, y - 10);
				ctx.lineTo(x + 10, y - 10);
				ctx.lineTo(x + 10, y -  5);
				// right bottom
				ctx.moveTo(x + 10, y +  5);
				ctx.lineTo(x + 10, y + 10);
				ctx.lineTo(x +  5, y + 10);
				// left bottom
				ctx.moveTo(x -  5, y + 10);
				ctx.lineTo(x - 10, y + 10);
				ctx.lineTo(x - 10, y +  5);
				ctx.stroke();
				ctx.restore();
			}

			drawTarget(this.image.temp_max_pos_w, this.image.temp_max_pos_h, '#ff0000');
			drawTarget(this.image.temp_min_pos_w, this.image.temp_min_pos_h, '#00ff00');

			ctx.fillStyle = '#ffffff';
			ctx.font = '15px Noto, sans-serif';
			ctx.textBaseline = 'bottom';
			ctx.textAlign = 'right';
			ctx.fillText(this.image.temp_max, image.width - 5, 45);

			ctx.textBaseline = 'top';
			ctx.textAlign = 'right';
			ctx.fillText(this.image.temp_min, image.width - 5, 255);

			ctx.drawImage(
				this.$refs.palette,
				0, 0, 1, 256,
				225, 50, 10, 200
			);
		},

		drawPalette: function () {
			const len = 256;
			const image = this.image;
			const canvas = this.$refs.palette;
			canvas.width = 1;
			canvas.height = len;
			const ctx = canvas.getContext('2d');
			const imagedata = ctx.createImageData(1, len);
			const palette_rgb = this.palette_rgb || image.palette_rgb;
			for (let i = 0; i < 256; i++) {
				const r = palette_rgb[i*3+0];
				const g = palette_rgb[i*3+1];
				const b = palette_rgb[i*3+2];
				imagedata.data[(len-i)*4+0] = r;
				imagedata.data[(len-i)*4+1] = g;
				imagedata.data[(len-i)*4+2] = b;
				imagedata.data[(len-i)*4+3] = 255;
			}
			ctx.putImageData(imagedata, 0, 0);
		},

//		drawPalette: function () {
//			const len = 256;
//			const image = this.image;
//			const canvas = this.$refs.palette;
//			canvas.width = len;
//			canvas.height = 1;
//			const ctx = canvas.getContext('2d');
//			const imagedata = ctx.createImageData(len, 1);
//			for (let i = 0; i < 256; i++) {
//				const r = image.palette_rgb[i*3+0];
//				const g = image.palette_rgb[i*3+1];
//				const b = image.palette_rgb[i*3+2];
//				imagedata.data[(i)*4+0] = r;
//				imagedata.data[(i)*4+1] = g;
//				imagedata.data[(i)*4+2] = b;
//				imagedata.data[(i)*4+3] = 255;
//			}
//			ctx.putImageData(imagedata, 0, 0);
//			console.log(canvas.toDataURL());
//		},

		withTempUnits : function (value) {
			if (!this.image) return "";
			const unit = '\u00B0' + this.image.temp_units;
			return value + unit;
		}
	}
})
