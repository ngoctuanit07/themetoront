<?php

class Sns_Toronto_Model_System_Config_Source_GridStyles
{
	public function toOptionArray() {
		return array(
			array('value'=>'style1', 'label'=>Mage::helper('toronto')->__('Default')),
			array('value'=>'style2', 'label'=>Mage::helper('toronto')->__('Style2'))
		);
	}
}
