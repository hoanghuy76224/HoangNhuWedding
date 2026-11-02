/* Fixed-length invitation codes. Guest names stay in Firestore, never in the URL. */
(function (root) {
  'use strict';
  var endpoint = 'https://firestore.googleapis.com/v1/projects/vo-iu-dino-848d2/databases/(default)/documents/invites_hoangnhu';
  var pattern = /^[A-Za-z0-9_-]{12}$/;
  function name(value) {
    var result = String(value || '').trim().normalize('NFC');
    if (!result || result.length > 80) throw new Error('Tên khách cần từ 1 đến 80 ký tự.');
    return result;
  }
  async function request(url, options) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch(url, Object.assign({}, options, {signal: controller.signal}));
      if (!response.ok) {
        var error = new Error(response.status === 403
          ? 'Firebase chưa cấp quyền lưu/đọc mã khách. Hãy cấu hình quyền trước khi tạo link.'
          : response.status === 404 ? 'Không tìm thấy lời mời này.' : 'Chưa kết nối được, vui lòng thử lại.');
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  root.InviteLinks = {
    async resolve(code) {
      if (!pattern.test(code)) throw new Error('Mã lời mời không hợp lệ.');
      var data = await request(endpoint + '/' + code);
      return name(data.fields && data.fields.name && data.fields.name.stringValue);
    },
    async create(value) {
      var guest = name(value);
      if (!root.getInviteToken) throw new Error('Firebase đang tải, vui lòng thử lại sau vài giây.');
      var token = await root.getInviteToken();
      for (var attempt = 0; attempt < 3; attempt++) {
        var bytes = crypto.getRandomValues(new Uint8Array(9));
        var code = btoa(String.fromCharCode.apply(null, bytes)).replace(/\+/g, '-').replace(/\//g, '_');
        try {
          await request(endpoint + '?documentId=' + code, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
            body: JSON.stringify({fields: {name: {stringValue: guest}}})
          });
          return {code: code, name: guest, link: location.origin + location.pathname + '?k=' + code};
        } catch (error) { if (error.status !== 409 || attempt === 2) throw error; }
      }
    }
  };
})(window);
