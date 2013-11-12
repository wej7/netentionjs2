'use strict';

describe('font1', function() {
  var font1_1 = decodeFontData('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');
  describe('test harness testing', function() {
    it('returns output', function() {
      var output;
      waitsFor(function() { return output; }, 10000);
      ttx(font1_1, function(result) { output = result; });
      runs(function() {
        verifyTtxOutput(output);
        expect(/<ttFont /.test(output)).toEqual(true);
        expect(/<\/ttFont>/.test(output)).toEqual(true);
      });
    });
  });
});